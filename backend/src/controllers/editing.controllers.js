import { EditProject, EditingTask } from "../models/editing.models.js";
import { Revision } from "../models/revision.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const getEditingData = asyncHandler(async (req, res) => {
    const editProjects = await EditProject.find({}).sort({ createdAt: -1 });
    const editingTasks = await EditingTask.find({}).sort({ createdAt: -1 });
    const revisions = await Revision.find({}).sort({ createdAt: -1 });

    const formattedProjects = editProjects.map(p => {
        const obj = p.toObject();
        obj.id = p._id.toString();
        return obj;
    });

    const formattedTasks = editingTasks.map(t => {
        const obj = t.toObject();
        obj.id = t._id.toString();
        return obj;
    });

    return res.status(200).json(new ApiResponse(200, {
        editingProjects: formattedProjects,
        tasks: formattedTasks,
        revisions
    }, "Editing data retrieved successfully"));
});

const updateTask = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const updateData = req.body;

    const task = await EditingTask.findOneAndUpdate(
        { taskId },
        { $set: updateData },
        { new: true }
    );

    if (!task) {
        throw new ApiError(404, "Editing task not found");
    }

    return res.status(200).json(new ApiResponse(200, { task }, "Task updated successfully"));
});

const addRevision = asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.projectId || !body.feedback) {
        throw new ApiError(400, "Project ID and feedback are required");
    }

    const revision = await Revision.create({
        projectId: body.projectId,
        clientName: body.clientName || "",
        editorName: body.editorName || "",
        revisionRound: Number(body.revisionRound || 1),
        feedback: body.feedback,
        feedbackGivenBy: req.user?.name || body.feedbackGivenBy || "Client",
        feedbackDate: new Date().toISOString(),
        updatedDraftLink: body.updatedDraftLink || "",
        status: "Pending",
        timestamp: new Date().toISOString()
    });

    return res.status(201).json(new ApiResponse(201, { revision }, "Revision added successfully"));
});

const assignTasks = asyncHandler(async (req, res) => {
    const { shoot_id, lead_id, client_name, email_id, client_email, data_link, tasks } = req.body;
    
    if (!shoot_id || !data_link || !Array.isArray(tasks) || tasks.length === 0) {
        throw new ApiError(400, "Shoot ID, data link, and at least one task are required");
    }

    const createdTasks = [];
    for (const task of tasks) {
        const newTask = await EditingTask.create({
            taskId: task.task_id || `TSK_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            editId: task.edit_id || "",
            shootId: shoot_id,
            leadId: lead_id || "",
            clientName: client_name || task.client_name || "",
            emailId: email_id || client_email || "",
            serviceType: task.service_type || "",
            taskType: task.task_type || "",
            taskLabel: task.task_label || "",
            dataLink: data_link,
            assignedToName: task.editor_name || task.assigned_to_name || "",
            assignedToEmail: task.editor_email || task.assigned_to_email || "",
            status: task.status || "Assigned",
            assignedAt: new Date().toISOString()
        });
        createdTasks.push(newTask);
    }

    return res.status(201).json(new ApiResponse(201, { tasks: createdTasks }, "Tasks assigned successfully"));
});

export { getEditingData, updateTask, addRevision, assignTasks };
