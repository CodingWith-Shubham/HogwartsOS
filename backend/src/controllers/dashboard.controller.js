import { Correction } from "../models/correction.model.js";
import { Revision } from "../models/revision.models.js";
import { EditProject } from "../models/editing.models.js";
import { Client } from "../models/client.models.js";
import { Payment } from "../models/payment.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const getCorrectionsVsRevisions = asyncHandler(async (req, res) => {
    if (req.user?.role !== "manager") {
        throw new ApiError(403, "Unauthorized access.");
    }

    // 1. Group corrections by projectId
    const correctionAgg = await Correction.aggregate([
        {
            $group: {
                _id: "$projectId",
                correctionCount: { $sum: 1 },
                openCorrections: {
                    $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] }
                },
                resolvedCorrections: {
                    $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] }
                },
                lastCorrectionAt: { $max: "$createdAt" },
                editorName: { $first: "$editorName" } // Taking the first editor for simplicity
            }
        }
    ]);

    // 2. Group revisions by projectId
    const revisionAgg = await Revision.aggregate([
        {
            $group: {
                _id: "$projectId",
                revisionCount: { $sum: 1 },
                lastRevisionAt: { $max: "$createdAt" },
                editorName: { $first: "$editorName" }
            }
        }
    ]);

    // 3. Map to a dictionary for easy merging
    const projectMap = {};

    correctionAgg.forEach(c => {
        projectMap[c._id] = {
            projectId: c._id,
            correctionCount: c.correctionCount,
            openCorrections: c.openCorrections,
            resolvedCorrections: c.resolvedCorrections,
            lastCorrectionAt: c.lastCorrectionAt,
            revisionCount: 0,
            lastRevisionAt: null,
            editorName: c.editorName || ""
        };
    });

    revisionAgg.forEach(r => {
        if (!projectMap[r._id]) {
            projectMap[r._id] = {
                projectId: r._id,
                correctionCount: 0,
                openCorrections: 0,
                resolvedCorrections: 0,
                lastCorrectionAt: null,
                revisionCount: 0,
                lastRevisionAt: null,
                editorName: ""
            };
        }
        projectMap[r._id].revisionCount = r.revisionCount;
        projectMap[r._id].lastRevisionAt = r.lastRevisionAt;
        if (r.editorName && !projectMap[r._id].editorName) {
            projectMap[r._id].editorName = r.editorName;
        }
    });

    // 4. Resolve project details (projectName/leadId and clientName)
    const combined = Object.values(projectMap);
    
    // Extract unique project IDs
    const projectIds = combined.map(p => p.projectId);
    
    // Fetch EditProjects that match the projectIds (leadId is what we use as projectId typically, or editId)
    // Looking at EditProject schema, leadId and editId are strings.
    // In Revision schema, projectId seems to match leadId or editId depending on how it was logged. Let's look up both or assume it's editId.
    const projects = await EditProject.find({
        $or: [
            { leadId: { $in: projectIds } },
            { editId: { $in: projectIds } }
        ]
    });

    const projectLookup = {};
    projects.forEach(p => {
        projectLookup[p.leadId] = p;
        projectLookup[p.editId] = p;
    });

    for (let item of combined) {
        const proj = projectLookup[item.projectId];
        if (proj) {
            item.projectName = proj.month ? `${proj.clientName} - ${proj.month}` : proj.clientName;
            item.clientName = proj.clientName;
        } else {
            item.projectName = item.projectId;
            item.clientName = "Unknown";
        }
    }

    // 5. Sort by most recent activity
    combined.sort((a, b) => {
        const aDate = new Date(Math.max(
            a.lastCorrectionAt ? new Date(a.lastCorrectionAt).getTime() : 0,
            a.lastRevisionAt ? new Date(a.lastRevisionAt).getTime() : 0
        ));
        const bDate = new Date(Math.max(
            b.lastCorrectionAt ? new Date(b.lastCorrectionAt).getTime() : 0,
            b.lastRevisionAt ? new Date(b.lastRevisionAt).getTime() : 0
        ));
        return bDate.getTime() - aDate.getTime();
    });

    return res.status(200).json(new ApiResponse(200, { data: combined }, "Corrections vs Revisions data retrieved"));
});

export const getRevenueMetrics = asyncHandler(async (req, res) => {
    // Only managers and admins should probably see this
    if (req.user?.role !== "manager" && req.user?.role !== "admin") {
        throw new ApiError(403, "Unauthorized access.");
    }

    const revisionPayments = await Payment.find({
        installmentLabel: "Revision Addon",
        paymentStatus: "Payment Verified"
    });

    const totalRevisionRevenue = revisionPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    return res.status(200).json(new ApiResponse(200, {
        metrics: {
            revisionAddonRevenue: totalRevisionRevenue
        }
    }, "Revenue metrics retrieved"));
});
