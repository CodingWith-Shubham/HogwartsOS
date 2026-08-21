import { Payment } from "../models/payment.models.js";
import { Client } from "../models/client.models.js";
import { Shoot } from "../models/shoot.models.js";
import { UpsellCrossSell } from "../models/upsellCrossSell.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendPushNotification } from "../services/notification.service.js";
import { User } from "../models/user.models.js";

// --- Editing-only bypass ---
// Leads pitched "Only editing" skip the shoot flow entirely. Once their payment
// is verified/completed we auto-create a placeholder shoot record so the project
// surfaces directly in the manager dashboard's "Assign Editor" queue.
const EDITING_ONLY_SERVICE_REGEX = /only[\s-]*editing/i;

const isEditingOnlyClient = (client) => {
    if (!client) return false;
    return EDITING_ONLY_SERVICE_REGEX.test(client.serviceNotes || "") ||
        EDITING_ONLY_SERVICE_REGEX.test(client.servicePitched || "");
};

const ensureEditingOnlyShoot = async (client) => {
    if (!isEditingOnlyClient(client)) return;

    const existingShoot = await Shoot.findOne({ leadId: client.leadId });
    if (existingShoot) return; // A real shoot already exists — keep the normal flow

    await Shoot.create({
        shootId: `EDITONLY_${client.leadId}`,
        leadId: client.leadId,
        clientName: client.name || "",
        contactNum: client.phoneNumber || "",
        clientEmailId: client.clientEmail || "",
        shootDate: "",
        shootStartTime: "",
        shootEndTime: "",
        camera: "",
        teleprompter: "No",
        totalHours: "",
        assignedTo: client.assignedTo || "",
        bts: "No",
        shootMemberName: "",
        shootMemberEmail: "",
        dataLink: "",
        // driveLinkUploaded=true surfaces the record in the manager's
        // "Footage Ready for Review" list without any shoot-team involvement.
        driveLinkUploaded: true,
        isEditingOnly: true,
        setName: ""
    });
};

const getPayments = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.leadId) filter.leadId = req.query.leadId;
    if (req.query.paymentId) filter.paymentId = req.query.paymentId;
    // Upsell/cross-sell scoping:
    // - ?upsellCrossSellId=<entryId> → payments for one specific upsell entry
    // - ?upsell=1                    → every payment tagged to an upsell entry
    // - ?excludeUpsell=1             → only regular lead-pipeline payments
    const upsellCrossSellId = String(req.query.upsellCrossSellId || req.query.upsell_crosssell_id || "").trim();
    if (upsellCrossSellId) {
        filter.upsellCrossSellId = upsellCrossSellId;
    } else if (req.query.upsell === "1" || req.query.upsell === "true") {
        filter.upsellCrossSellId = { $ne: "" };
    } else if (req.query.excludeUpsell === "1" || req.query.excludeUpsell === "true" || req.query.exclude_upsell === "1" || req.query.exclude_upsell === "true") {
        filter.$or = [
            { upsellCrossSellId: "" },
            { upsellCrossSellId: { $exists: false } }
        ];
    }
    
    const payments = await Payment.find(filter).sort({ createdAt: -1 });
    const formatted = payments.map(p => {
        const obj = p.toObject();
        obj.id = p._id.toString();
        return obj;
    });
    return res.status(200).json(new ApiResponse(200, { payments: formatted }, "Payments retrieved successfully"));
});

const createPayment = asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.leadId || !body.amount) {
        throw new ApiError(400, "Lead ID and amount are required");
    }

    const paymentId = body.paymentId || `PAY_${Date.now()}`;
    const payment = await Payment.create({
        paymentId,
        leadId: body.leadId,
        clientName: body.clientName || "",
        amount: Number(body.amount),
        paymentLinkSent: Boolean(body.paymentLinkSent),
        paymentLinkSentAt: body.paymentLinkSentAt || new Date().toISOString(),
        screenshotUrl: body.screenshotUrl || "",
        utrNumber: body.utrNumber || "Not provided",
        // Default to "Link Sent" — do NOT default to "Payment Verified".
        // Verification only happens when the salesperson explicitly verifies via the dashboard.
        paymentStatus: body.paymentStatus || "Link Sent",
        verifiedBy: body.verifiedBy || "",
        // Only set verifiedAt when an actual verification status is provided
        verifiedAt: body.verifiedBy ? (body.verifiedAt || new Date().toISOString()) : "",
        totalCost: Number(body.totalCost || 0),
        remainingAmount: Number(body.remainingAmount || 0),
        paymentCompleted: Boolean(body.paymentCompleted),
        installmentNumber: body.installmentNumber || "1",
        installmentLabel: body.installmentLabel || "Advance",
        paymentMode: body.paymentMode || "Online",
        amountPaidSoFar: Number(body.amountPaidSoFar || 0),
        // Forwarded by n8n when the payment link was sent from the
        // upsell/cross-sell pipeline (accepts snake_case too).
        upsellCrossSellId: String(body.upsellCrossSellId || body.upsell_crosssell_id || "").trim()
    });

    // Only update client status for cash payments (immediately verified) or
    // for payment completion — NOT for online payment link creation.
    // Online payments remain "Payment Link Sent" until screenshot is uploaded.
    if (payment.paymentMode === 'Cash' || payment.paymentCompleted) {
        const status = payment.paymentCompleted ? "Payment Completed" : "Payment Verified";
        if (payment.upsellCrossSellId) {
            // Upsell/cross-sell cash payment: advance the upsell entry, never the lead.
            const upsellEntry = await UpsellCrossSell.findById(payment.upsellCrossSellId);
            if (upsellEntry && ["initiated", "proposal_sent", "payment_sent"].includes(upsellEntry.status)) {
                upsellEntry.status = "payment_done";
                await upsellEntry.save();
            }
        } else {
            const client = await Client.findOneAndUpdate(
                { leadId: body.leadId },
                { $set: { status } }
            );
            // Editing-only projects bypass shoot scheduling and go straight to editor assignment
            await ensureEditingOnlyShoot(client);
        }
    }

    return res.status(201).json(new ApiResponse(201, { payment }, "Payment created successfully"));
});

const verifyPayment = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const body = req.body;

    // Determine the status to set
    let newPaymentStatus = body.paymentStatus;
    
    // Safety override: if n8n is sending a screenshot upload, force it to 'Screenshot Received' 
    // to prevent accidental auto-verification if the n8n workflow is misconfigured to send 'Payment Verified'
    if (req.user?._id === 'n8n-system') {
        if (body.screenshotUrl) {
            newPaymentStatus = "Screenshot Received";
            body.verifiedBy = ""; // Clear out any accidental verifier name
        }
        
        // Anti-Gmail-Prefetch logic removed by user request. 
        // Be warned: Gmail may auto-click the verification link when it scans emails!
        // if (newPaymentStatus === "Payment Verified") {
        //     const existing = await Payment.findOne({ paymentId });
        //     return res.status(200).json(new ApiResponse(200, { payment: existing }, "Ignored n8n auto-verify to prevent Gmail prefetch bug"));
        // }
    } else if (!newPaymentStatus) {
        if (body.screenshotUrl) {
            newPaymentStatus = "Screenshot Received";
        } else {
            newPaymentStatus = "Payment Verified"; // fallback for legacy behavior
        }
    }

    const updateFields = {
        paymentStatus: newPaymentStatus,
        // Only set verified fields if it's actually being verified, not just receiving a screenshot
        ...(newPaymentStatus === "Payment Verified" && {
            verifiedBy: body.verifiedBy || req.user?.name || "System",
            verifiedAt: body.verifiedAt || new Date().toISOString(),
        })
    };

    // Persist screenshot URL if provided (set by n8n when client uploads)
    if (body.screenshotUrl) {
        updateFields.screenshotUrl = body.screenshotUrl;
    }

    // Persist UTR / transaction reference number if provided
    if (body.utrNumber) {
        updateFields.utrNumber = body.utrNumber;
    }

    // Update running payment totals if the n8n confirm workflow provides them
    if (body.amountPaidSoFar !== undefined) {
        updateFields.amountPaidSoFar = Number(body.amountPaidSoFar);
    }
    if (body.remainingAmount !== undefined) {
        updateFields.remainingAmount = Number(body.remainingAmount);
    }
    if (body.paymentCompleted !== undefined) {
        updateFields.paymentCompleted = Boolean(body.paymentCompleted);
    }

    const payment = await Payment.findOneAndUpdate(
        { paymentId },
        { $set: updateFields },
        { new: true }
    );

    if (!payment) {
        throw new ApiError(404, "Payment record not found");
    }

    // Also update the Client status so the pipeline reflects the current state
    let clientStatus;
    if (newPaymentStatus === "Screenshot Received" || newPaymentStatus === "Screenshot Uploaded") {
        clientStatus = "Payment Under Review";
        const client = await Client.findOne({ leadId: payment.leadId });
        const notifyUserIds = [];
        if (client && client.assignedTo) {
            const salesUser = await User.findOne({
                $or: [
                    { name: new RegExp(`^${client.assignedTo}$`, 'i') },
                    { email: new RegExp(`^${client.assignedTo}$`, 'i') },
                    { username: new RegExp(`^${client.assignedTo}$`, 'i') }
                ]
            });
            if (salesUser) notifyUserIds.push(salesUser._id);
        }
        sendPushNotification({ userIds: notifyUserIds, roles: ['admin', 'super_admin'] }, {
            title: 'Payment needs verification',
            message: `A payment screenshot has been uploaded.`,
            href: '/manager'
        }).catch(console.error);
    } else if (newPaymentStatus === "Payment Verified") {
        clientStatus = payment.paymentCompleted ? "Payment Completed" : "Payment Verified";
    } else if (body.paymentCompleted || payment.paymentCompleted) {
        clientStatus = "Payment Completed";
    }

    if (clientStatus) {
        if (payment.upsellCrossSellId) {
            // Upsell/cross-sell payment: advance the parallel pipeline entry —
            // the original Client/Lead record is NEVER touched.
            const upsellEntry = await UpsellCrossSell.findById(payment.upsellCrossSellId);
            if (
                upsellEntry &&
                (clientStatus === "Payment Verified" || clientStatus === "Payment Completed") &&
                ["initiated", "proposal_sent", "payment_sent"].includes(upsellEntry.status)
            ) {
                // Mirrors the lead flow: verification marks the upsell deal paid.
                // Editing-only entries are now ready for the manager's
                // Assign Editor queue (payment_done + editingOnly is its trigger);
                // shoot-based entries move on to shoot scheduling.
                upsellEntry.status = "payment_done";
                await upsellEntry.save();
            }
        } else {
            const client = await Client.findOneAndUpdate(
                { leadId: payment.leadId },
                { $set: { status: clientStatus } }
            );
            if (clientStatus === "Payment Verified" || clientStatus === "Payment Completed") {
                // Editing-only projects bypass the shoot flow and go straight to editor assignment
                await ensureEditingOnlyShoot(client);
            }
        }
    }

    return res.status(200).json(new ApiResponse(200, { payment }, "Payment updated successfully"));
});

export { getPayments, createPayment, verifyPayment };
