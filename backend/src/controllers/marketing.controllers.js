import { MarketingTask } from "../models/marketing.models.js";
import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendPushNotification } from "../services/notification.service.js";

const getMarketingTasks = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) {
        filter.status = req.query.status;
    }
    if (req.query.assignedToEmail) {
        filter.assignedToEmail = req.query.assignedToEmail;
    }
    const tasks = await MarketingTask.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, { tasks }, "Marketing tasks retrieved successfully"));
});

const assignMarketingTask = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const { assignedToName, assignedToEmail } = req.body;

    if (!assignedToName || !assignedToEmail) {
        throw new ApiError(400, "Assigned to name and email are required");
    }

    const task = await MarketingTask.findOneAndUpdate(
        { taskId },
        { 
            $set: { 
                assignedToName, 
                assignedToEmail, 
                status: "Assigned",
                assignedAt: new Date().toISOString()
            } 
        },
        { new: true }
    );

    if (!task) {
        throw new ApiError(404, "Marketing task not found");
    }

    const user = await User.findOne({ email: assignedToEmail });
    if (user) {
        sendPushNotification({ userIds: [user._id] }, {
            title: 'New Marketing Task Assigned',
            message: `You have been assigned a new marketing task for client ${task.clientName}`,
            href: '/marketing'
        }).catch(console.error);
    }

    return res.status(200).json(new ApiResponse(200, { task }, "Task assigned successfully"));
});

const updateMarketingTaskStatus = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!["Assigned", "In Progress", "Completed"].includes(status)) {
        throw new ApiError(400, "Invalid status");
    }

    const updateFields = { status };
    if (status === "Completed") {
        updateFields.completedAt = new Date().toISOString();
    }

    const task = await MarketingTask.findOneAndUpdate(
        { taskId },
        { $set: updateFields },
        { new: true }
    );

    if (!task) {
        throw new ApiError(404, "Marketing task not found");
    }

    return res.status(200).json(new ApiResponse(200, { task }, "Task status updated successfully"));
});

export { getMarketingTasks, assignMarketingTask, updateMarketingTaskStatus };
