import { Correction } from "../models/correction.model.js";
import { EditProject, EditingTask } from "../models/editing.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const createCorrection = asyncHandler(async (req, res) => {
    const { projectId, editingTaskId, editorId, editorName, note } = req.body;
    
    if (req.user?.role !== "manager") {
        throw new ApiError(403, "Only managers can raise corrections.");
    }

    if (!projectId || !editingTaskId || !note) {
        throw new ApiError(400, "Project ID, Editing Task ID, and Note are required.");
    }

    // Auto-calculate round: count existing corrections for this task + 1
    const existingCorrectionsCount = await Correction.countDocuments({ editingTaskId });
    const round = existingCorrectionsCount + 1;

    const correction = await Correction.create({
        projectId,
        editingTaskId,
        editorId: editorId || "",
        editorName: editorName || "",
        raisedBy: req.user._id,
        raisedByName: req.user.name || "Manager",
        note,
        round
    });

    return res.status(201).json(new ApiResponse(201, { correction }, "Correction raised successfully"));
});

const resolveCorrection = asyncHandler(async (req, res) => {
    if (req.user?.role !== "manager") {
        throw new ApiError(403, "Only managers can resolve corrections.");
    }

    const { correctionId } = req.params;
    const correction = await Correction.findByIdAndUpdate(
        correctionId,
        {
            status: "resolved",
            resolvedAt: new Date()
        },
        { new: true }
    );

    if (!correction) {
        throw new ApiError(404, "Correction not found.");
    }

    return res.status(200).json(new ApiResponse(200, { correction }, "Correction marked as resolved"));
});

const getCorrectionsByTask = asyncHandler(async (req, res) => {
    if (req.user?.role !== "manager") {
        throw new ApiError(403, "Unauthorized access to corrections.");
    }

    const { editingTaskId } = req.params;
    const corrections = await Correction.find({ editingTaskId }).sort({ createdAt: -1 });
    
    return res.status(200).json(new ApiResponse(200, { corrections }, "Corrections retrieved successfully"));
});

const getCorrectionsByProject = asyncHandler(async (req, res) => {
    if (req.user?.role !== "manager") {
        throw new ApiError(403, "Unauthorized access to corrections.");
    }

    const { projectId } = req.params;
    const corrections = await Correction.find({ projectId }).sort({ createdAt: -1 });

    // Group by editingTaskId
    const grouped = corrections.reduce((acc, correction) => {
        if (!acc[correction.editingTaskId]) {
            acc[correction.editingTaskId] = [];
        }
        acc[correction.editingTaskId].push(correction);
        return acc;
    }, {});

    return res.status(200).json(new ApiResponse(200, { groupedCorrections: grouped }, "Project corrections retrieved successfully"));
});

const getCorrectionSummary = asyncHandler(async (req, res) => {
    if (req.user?.role !== "manager") {
        throw new ApiError(403, "Unauthorized access to corrections.");
    }

    const summary = await Correction.aggregate([
        {
            $group: {
                _id: "$editorId",
                editorName: { $first: "$editorName" },
                totalCorrections: { $sum: 1 },
                openCorrections: {
                    $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] }
                },
                resolvedCorrections: {
                    $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] }
                },
                taskIds: { $addToSet: "$editingTaskId" }
            }
        },
        {
            $project: {
                editorId: "$_id",
                editorName: 1,
                totalCorrections: 1,
                openCorrections: 1,
                resolvedCorrections: 1,
                taskCount: { $size: "$taskIds" }
            }
        },
        { $sort: { totalCorrections: -1 } }
    ]);

    return res.status(200).json(new ApiResponse(200, { summary }, "Correction summary retrieved successfully"));
});

export {
    createCorrection,
    resolveCorrection,
    getCorrectionsByTask,
    getCorrectionsByProject,
    getCorrectionSummary
};
