import mongoose from "mongoose";
import { UpsellCrossSell, UPSELL_CROSSSELL_STATUSES } from "../models/upsellCrossSell.models.js";
import { Client } from "../models/client.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * Roles allowed to work the upsell / cross-sell pipeline:
 * super admin (admin / super_admin), manager, sales rep.
 */
const PIPELINE_ROLES = ["admin", "super_admin", "manager", "sales"];
const MANAGER_ROLES = ["admin", "super_admin", "manager"];

const assertPipelineRole = (req) => {
    const role = req.user?.role;
    if (!role || !PIPELINE_ROLES.includes(role)) {
        throw new ApiError(403, "Forbidden: upsell/cross-sell access requires super admin, manager or sales rep role");
    }
};

/**
 * Services that do NOT need a shoot — editing-only fulfilment.
 * Matched case-insensitively as substrings against selected service names.
 */
const EDITING_ONLY_MARKERS = ["thumbnail", "editing", "edit", "social media", "design", "marketing"];

const isEditingOnlyService = (serviceName) => {
    const s = (serviceName || "").trim().toLowerCase();
    if (!s) return false;
    return EDITING_ONLY_MARKERS.some((marker) => s.includes(marker));
};

/**
 * Editing-only bypass: true only when EVERY selected service requires no shoot.
 */
const detectEditingOnly = (services) => {
    if (!Array.isArray(services) || services.length === 0) return false;
    return services.every(isEditingOnlyService);
};

/**
 * Allowed forward transitions. The payment_done → editing transition is the
 * editing-only bypass and is validated against the document's editingOnly flag.
 */
const ALLOWED_TRANSITIONS = {
    initiated: ["proposal_sent"],
    proposal_sent: ["payment_sent"],
    payment_sent: ["payment_done"],
    payment_done: ["shoot_scheduled", "editing"],
    shoot_scheduled: ["shoot_done"],
    shoot_done: ["editing"],
    editing: ["delivered"],
    delivered: []
};

const resolveClient = async (rawClientId) => {
    if (!rawClientId) return null;
    const id = String(rawClientId).trim();
    if (mongoose.isValidObjectId(id)) {
        const byObjectId = await Client.findById(id);
        if (byObjectId) return byObjectId;
    }
    // Fall back to business key (leadId) — the Clients tab works with leadIds.
    return Client.findOne({ leadId: id });
};

/**
 * POST /api/v1/upsell-crosssell
 * Initiate an upsell or cross-sell for an EXISTING client.
 * Body: { clientId | clientLeadId | existingClientId, type, services[], cost, assignedTo, notes, editingOnly? }
 */
const createUpsellCrossSell = asyncHandler(async (req, res) => {
    assertPipelineRole(req);

    const {
        clientId: rawClientId,
        clientLeadId,
        existingClientId,
        type,
        services,
        cost,
        assignedTo,
        notes,
        editingOnly
    } = req.body;

    const client = await resolveClient(rawClientId || clientLeadId || existingClientId);
    if (!client) {
        throw new ApiError(404, "Existing client not found");
    }

    if (!["upsell", "crosssell", "newsale"].includes(type)) {
        throw new ApiError(400, "type must be either 'upsell', 'crosssell', or 'newsale'");
    }

    const serviceList = Array.isArray(services)
        ? services.map((s) => String(s).trim()).filter(Boolean)
        : [];
    if (serviceList.length === 0) {
        throw new ApiError(400, "At least one service is required");
    }


    // Bypass flag: explicit body flag wins; otherwise derived from the services.
    const editingOnlyFlag = typeof editingOnly === "boolean"
        ? editingOnly
        : detectEditingOnly(serviceList);

    const entry = await UpsellCrossSell.create({
        clientId: client._id,
        clientLeadId: client.leadId || "",
        clientName: client.name,
        clientPhone: client.phoneNumber || "",
        clientEmail: client.clientEmail || "",
        type,
        services: serviceList,
        cost: Number(cost || 0),
        assignedTo: assignedTo || req.user?.name || "",
        notes: notes || "",
        reachout_done: "yes",
        editingOnly: editingOnlyFlag,
        status: "initiated"
    });

    const message = type === "crosssell"
        ? "Cross-sell initiated successfully"
        : type === "newsale"
        ? "New sale initiated successfully"
        : "Upsell initiated successfully";

    return res.status(201).json(new ApiResponse(201, { entry }, message));
});

/**
 * GET /api/v1/upsell-crosssell
 * Query: type, status, clientId, clientLeadId, editingOnly, limit
 * Sales reps only see entries assigned to them.
 */
const getUpsellCrossSells = asyncHandler(async (req, res) => {
    assertPipelineRole(req);

    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.clientLeadId) filter.clientLeadId = req.query.clientLeadId;
    if (req.query.editingOnly !== undefined) filter.editingOnly = req.query.editingOnly === "true";
    if (req.query.clientId) {
        const client = await resolveClient(req.query.clientId);
        filter.$or = [
            { clientLeadId: client?.leadId || String(req.query.clientId) },
            ...(client ? [{ clientId: client._id }] : [])
        ];
    }

    let query = UpsellCrossSell.find(filter).sort({ createdAt: -1 });
    if (req.query.limit) query = query.limit(Number(req.query.limit));
    let entries = await query;

    const user = req.user;
    if (user && user.role === "sales") {
        const uname = user.name?.trim().toLowerCase();
        const uemail = user.email?.trim().toLowerCase();
        const uusername = user.username?.trim().toLowerCase();
        entries = entries.filter((entry) => {
            const assigned = (entry.assignedTo || "").trim().toLowerCase();
            return assigned === uname || assigned === uemail || assigned === uusername;
        });
    }

    entries = entries.map(e => {
        const obj = typeof e.toObject === 'function' ? e.toObject() : { ...e };
        if (obj.deliverable_sets && (!obj.deliverableSets || obj.deliverableSets.length === 0)) {
            obj.deliverableSets = obj.deliverable_sets;
        }
        return obj;
    });

    return res.status(200).json(new ApiResponse(200, { entries }, "Upsell/cross-sell entries retrieved"));
});

/**
 * GET /api/v1/upsell-crosssell/pending-editor-assignment
 * Entries waiting for an editor: editingOnly → payment_done, normal → shoot_done.
 */
const getPendingEditorAssignment = asyncHandler(async (req, res) => {
    assertPipelineRole(req);

    const regexCondition = { $regex: /only[\s-]*editing|only[\s-]*marketing/i };

    const entries = await UpsellCrossSell.find({
        $or: [
            { editingOnly: true, status: "payment_done" },
            { 
                status: "payment_done",
                $or: [
                    { services: regexCondition },
                    { "deliverableSets.serviceName": regexCondition },
                    { "deliverableSets.service": regexCondition },
                    { "deliverable_sets.serviceName": regexCondition },
                    { "deliverable_sets.service": regexCondition }
                ]
            },
            { editingOnly: false, status: "shoot_done" }
        ]
    }).sort({ updatedAt: -1 });

    return res.status(200).json(new ApiResponse(200, { entries }, "Pending editor assignment entries retrieved"));
});

/**
 * GET /api/v1/upsell-crosssell/clients/summary
 * Per-client rollup used by the Clients tab (badges + Upsell Clients sub-tab).
 */
const getClientsUpsellSummary = asyncHandler(async (req, res) => {
    assertPipelineRole(req);

    const grouped = await UpsellCrossSell.aggregate([
        {
            $group: {
                _id: "$clientLeadId",
                clientId: { $last: "$clientId" },
                clientName: { $last: "$clientName" },
                clientEmail: { $last: "$clientEmail" },
                total: { $sum: 1 },
                upsellCount: { $sum: { $cond: [{ $eq: ["$type", "upsell"] }, 1, 0] } },
                crosssellCount: { $sum: { $cond: [{ $eq: ["$type", "crosssell"] }, 1, 0] } },
                newsaleCount: { $sum: { $cond: [{ $eq: ["$type", "newsale"] }, 1, 0] } },
                activeCount: { $sum: { $cond: [{ $ne: ["$status", "delivered"] }, 1, 0] } },
                latestStatus: { $last: "$status" },
                latestType: { $last: "$type" },
                latestAt: { $max: "$updatedAt" }
            }
        },
        { $sort: { latestAt: -1 } }
    ]);

    return res.status(200).json(new ApiResponse(200, {
        clients: grouped.map((g) => ({
            clientId: g.clientId,
            clientLeadId: g._id,
            clientName: g.clientName,
            clientEmail: g.clientEmail,
            total: g.total,
            upsellCount: g.upsellCount,
            crosssellCount: g.crosssellCount,
            newsaleCount: g.newsaleCount,
            activeCount: g.activeCount,
            latestStatus: g.latestStatus,
            latestType: g.latestType,
            latestAt: g.latestAt
        }))
    }, "Upsell client summary retrieved"));
});

/**
 * GET /api/v1/upsell-crosssell/metrics/summary
 * Tracking & analytics for the Upsell & Cross-Sell section.
 */
const getUpsellCrossSellMetrics = asyncHandler(async (req, res) => {
    assertPipelineRole(req);

    const percent = (num, den) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);

    const [
        totalUpsells,
        totalCrosssells,
        deliveredUpsells,
        deliveredCrosssells,
        upsellRevenueAgg,
        crosssellRevenueAgg,
        statusBreakdown,
        repBreakdown
    ] = await Promise.all([
        UpsellCrossSell.countDocuments({ type: "upsell" }),
        UpsellCrossSell.countDocuments({ type: "crosssell" }),
        UpsellCrossSell.countDocuments({ type: "upsell", status: "delivered" }),
        UpsellCrossSell.countDocuments({ type: "crosssell", status: "delivered" }),
        UpsellCrossSell.aggregate([
            { $match: { type: "upsell", status: "delivered" } },
            { $group: { _id: null, revenue: { $sum: "$cost" } } }
        ]),
        UpsellCrossSell.aggregate([
            { $match: { type: "crosssell", status: "delivered" } },
            { $group: { _id: null, revenue: { $sum: "$cost" } } }
        ]),
        UpsellCrossSell.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]),
        UpsellCrossSell.aggregate([
            { $match: { assignedTo: { $ne: "" } } },
            {
                $group: {
                    _id: "$assignedTo",
                    count: { $sum: 1 },
                    delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
                    revenue: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$cost", 0] } }
                }
            },
            { $sort: { count: -1, delivered: -1 } }
        ])
    ]);

    // Pipeline funnel — always emit every stage, even when the count is zero.
    const statusCountMap = new Map(statusBreakdown.map((s) => [s._id, s.count]));
    const pipeline = UPSELL_CROSSSELL_STATUSES.map((status) => ({
        status,
        count: statusCountMap.get(status) || 0
    }));

    const topRep = repBreakdown[0] || null;

    return res.status(200).json(new ApiResponse(200, {
        totalUpsells,
        totalCrosssells,
        upsellConversionRate: percent(deliveredUpsells, totalUpsells),
        crosssellConversionRate: percent(deliveredCrosssells, totalCrosssells),
        revenueFromUpsells: upsellRevenueAgg[0]?.revenue || 0,
        revenueFromCrosssells: crosssellRevenueAgg[0]?.revenue || 0,
        pipeline,
        topAssignedRep: topRep
            ? { name: topRep._id, count: topRep.count, delivered: topRep.delivered, revenue: topRep.revenue }
            : null,
        repBreakdown: repBreakdown.map((r) => ({
            name: r._id,
            count: r.count,
            delivered: r.delivered,
            revenue: r.revenue
        }))
    }, "Upsell/cross-sell metrics retrieved"));
});

/**
 * GET /api/v1/upsell-crosssell/:id
 */
const getUpsellCrossSellById = asyncHandler(async (req, res) => {
    assertPipelineRole(req);

    const entry = await UpsellCrossSell.findById(req.params.id);
    if (!entry) {
        throw new ApiError(404, "Upsell/cross-sell entry not found");
    }

    const obj = typeof entry.toObject === 'function' ? entry.toObject() : { ...entry };
    if (obj.deliverable_sets && (!obj.deliverableSets || obj.deliverableSets.length === 0)) {
        obj.deliverableSets = obj.deliverable_sets;
    }

    return res.status(200).json(new ApiResponse(200, { entry: obj }, "Entry retrieved"));
});

/**
 * PATCH /api/v1/upsell-crosssell/:id
 * General updates (notes, cost, assignedTo, services). Services change re-derives editingOnly.
 */
const updateUpsellCrossSell = asyncHandler(async (req, res) => {
    assertPipelineRole(req);

    const entry = await UpsellCrossSell.findById(req.params.id);
    if (!entry) {
        throw new ApiError(404, "Upsell/cross-sell entry not found");
    }

    const allowed = [
        "cost",
        "assignedTo",
        "notes",
        "services",
        "editingOnly",
        "proposalAccepted",
        "proposalRevoked",
        "proposalRevokeReason",
        "deliverableSets",
        "deliverable_sets"
    ];
    const updates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.services !== undefined) {
        if (!Array.isArray(updates.services) || updates.services.length === 0) {
            throw new ApiError(400, "services must be a non-empty array");
        }
        updates.services = updates.services.map((s) => String(s).trim()).filter(Boolean);
        if (updates.editingOnly === undefined) {
            updates.editingOnly = detectEditingOnly(updates.services);
        }
    }
    if (updates.cost !== undefined) updates.cost = Number(updates.cost || 0);

    const updated = await UpsellCrossSell.findByIdAndUpdate(entry._id, { $set: updates }, { new: true });

    return res.status(200).json(new ApiResponse(200, { entry: updated }, "Entry updated successfully"));
});

/**
 * PATCH /api/v1/upsell-crosssell/:id/status
 * Advance the pipeline. Body: { status, proposalLink?, paymentLink?, shootLink? }
 * Enforces the stage order and the editing-only bypass.
 */
const updateUpsellCrossSellStatus = asyncHandler(async (req, res) => {
    assertPipelineRole(req);

    const { status, proposalLink, paymentLink, shootLink } = req.body;

    if (!status || !UPSELL_CROSSSELL_STATUSES.includes(status)) {
        throw new ApiError(400, `status must be one of: ${UPSELL_CROSSSELL_STATUSES.join(", ")}`);
    }

    const entry = await UpsellCrossSell.findById(req.params.id);
    if (!entry) {
        throw new ApiError(404, "Upsell/cross-sell entry not found");
    }

    if (entry.status === status) {
        // Idempotent — still allow link updates for the current stage.
        const linkUpdates = {};
        if (proposalLink !== undefined) linkUpdates.proposalLink = proposalLink;
        if (paymentLink !== undefined) linkUpdates.paymentLink = paymentLink;
        if (shootLink !== undefined) linkUpdates.shootLink = shootLink;
        const updated = await UpsellCrossSell.findByIdAndUpdate(entry._id, { $set: linkUpdates }, { new: true });
        return res.status(200).json(new ApiResponse(200, { entry: updated }, "Entry already at this status"));
    }

    const allowed = ALLOWED_TRANSITIONS[entry.status] || [];
    if (!allowed.includes(status)) {
        throw new ApiError(400, `Invalid status transition: '${entry.status}' → '${status}'`);
    }

    // Editing-only bypass guard — shoot stages only apply to shoot-based services.
    if (entry.editingOnly && ["shoot_scheduled", "shoot_done"].includes(status)) {
        throw new ApiError(400, "This entry is editing-only — shoot stages are skipped. Go payment_done → editing.");
    }
    if (!entry.editingOnly && entry.status === "payment_done" && status === "editing") {
        throw new ApiError(400, "Shoot stages cannot be skipped for shoot-based services");
    }

    const updates = { status };
    if (proposalLink !== undefined) updates.proposalLink = proposalLink;
    if (paymentLink !== undefined) updates.paymentLink = paymentLink;
    if (shootLink !== undefined) updates.shootLink = shootLink;

    // A (re-)sent proposal starts a fresh acceptance round — mirrors the lead
    // pipeline where a revoked proposal can be re-sent from a clean slate.
    if (status === "proposal_sent") {
        updates.proposalAccepted = false;
        updates.proposalRevoked = false;
        updates.proposalRevokeReason = "";
    }

    const updated = await UpsellCrossSell.findByIdAndUpdate(entry._id, { $set: updates }, { new: true });

    return res.status(200).json(new ApiResponse(200, { entry: updated }, `Status updated to ${status}`));
});

/**
 * PATCH /api/v1/upsell-crosssell/:id/proposal-response
 * Records the client's response to a sent proposal — the upsell/cross-sell
 * equivalent of the lead pipeline's "Proposal Accepted" / "Proposal Revoked".
 * Called by the n8n proposal-confirmation workflow (x-n8n-secret) or directly
 * by a pipeline user.
 *
 * Body (either style):
 *   { action: "accepted" | "revoked", reason?: string }
 *   { proposalAccepted?: boolean, proposalRevoked?: boolean, reason?, proposalRevokeReason? }
 */
const updateProposalResponse = asyncHandler(async (req, res) => {
    if (req.user?._id !== "n8n-system") {
        assertPipelineRole(req);
    }

    const entry = await UpsellCrossSell.findById(req.params.id);
    if (!entry) {
        throw new ApiError(404, "Upsell/cross-sell entry not found");
    }

    const body = req.body || {};
    const action = String(body.action || "").trim().toLowerCase();
    const reason = String(body.reason ?? body.proposalRevokeReason ?? "").trim();

    let accepted;
    let revoked;
    if (["accepted", "approve", "approved"].includes(action)) {
        accepted = true;
        revoked = false;
    } else if (["revoked", "rejected", "declined"].includes(action)) {
        accepted = false;
        revoked = true;
    } else if (body.proposalAccepted !== undefined || body.proposalRevoked !== undefined) {
        accepted = Boolean(body.proposalAccepted);
        revoked = body.proposalRevoked !== undefined ? Boolean(body.proposalRevoked) : !accepted;
    } else {
        throw new ApiError(400, "Provide action ('accepted' | 'revoked') or proposalAccepted / proposalRevoked flags");
    }

    const updates = {
        proposalAccepted: accepted,
        proposalRevoked: revoked,
        proposalRevokeReason: revoked ? reason : ""
    };

    if (accepted && entry.status === "initiated") {
        // Safety net: accepting implies the proposal was sent.
        updates.status = "proposal_sent";
    }
    if (revoked && entry.status === "proposal_sent") {
        // Same as a lead's "Proposal Revoked": back to the pre-proposal stage
        // so the rep can correct and re-send the proposal.
        updates.status = "initiated";
    }

    const updated = await UpsellCrossSell.findByIdAndUpdate(entry._id, { $set: updates }, { new: true });

    return res.status(200).json(new ApiResponse(200, { entry: updated }, accepted ? "Proposal accepted" : "Proposal revoked"));
});



/**
 * PATCH /api/v1/upsell-crosssell/:id/assign-editor
 * Manager assigns an editor → status becomes 'editing'.
 * Body: { editorAssigned }
 */
const assignEditorToUpsell = asyncHandler(async (req, res) => {
    const role = req.user?.role;
    if (!role || !MANAGER_ROLES.includes(role)) {
        throw new ApiError(403, "Forbidden: only managers can assign editors");
    }

    const { editorAssigned } = req.body;
    if (!editorAssigned || !String(editorAssigned).trim()) {
        throw new ApiError(400, "editorAssigned is required");
    }

    const entry = await UpsellCrossSell.findById(req.params.id);
    if (!entry) {
        throw new ApiError(404, "Upsell/cross-sell entry not found");
    }

    const isReady = entry.editingOnly
        ? entry.status === "payment_done"
        : entry.status === "shoot_done";

    if (!isReady) {
        throw new ApiError(400, `Entry is not ready for editor assignment (current status: ${entry.status})`);
    }

    const updated = await UpsellCrossSell.findByIdAndUpdate(
        entry._id,
        { $set: { editorAssigned: String(editorAssigned).trim(), status: "editing" } },
        { new: true }
    );

    return res.status(200).json(new ApiResponse(200, { entry: updated }, "Editor assigned — entry moved to editing"));
});

/**
 * DELETE /api/v1/upsell-crosssell/:id
 * Managers + super admins only.
 */
const deleteUpsellCrossSell = asyncHandler(async (req, res) => {
    const role = req.user?.role;
    if (!role || !MANAGER_ROLES.includes(role)) {
        throw new ApiError(403, "Forbidden: only managers can delete upsell/cross-sell entries");
    }

    const deleted = await UpsellCrossSell.findByIdAndDelete(req.params.id);
    if (!deleted) {
        throw new ApiError(404, "Upsell/cross-sell entry not found");
    }

    return res.status(200).json(new ApiResponse(200, { entry: deleted }, "Entry deleted successfully"));
});

export {
    createUpsellCrossSell,
    getUpsellCrossSells,
    getUpsellCrossSellById,
    getPendingEditorAssignment,
    getClientsUpsellSummary,
    getUpsellCrossSellMetrics,
    updateUpsellCrossSell,
    updateUpsellCrossSellStatus,
    updateProposalResponse,
    assignEditorToUpsell,
    deleteUpsellCrossSell
};
