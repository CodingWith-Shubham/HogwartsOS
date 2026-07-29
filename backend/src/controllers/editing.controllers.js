import { EditProject, EditingTask } from "../models/editing.models.js";
import { Revision } from "../models/revision.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const getEditingData = asyncHandler(async (req, res) => {
    const taskFilter = {};
    if (req.query.editorEmail) taskFilter.assignedToEmail = req.query.editorEmail;

    const editProjects = await EditProject.find({}).sort({ createdAt: -1 });
    const editingTasks = await EditingTask.find(taskFilter).sort({ createdAt: -1 });
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

    if (updateData.managerComment === "" || updateData.managerComment === undefined) {
        delete updateData.managerComment;
    }

    let task = await EditingTask.findOneAndUpdate(
        { taskId },
        { $set: updateData },
        { new: true }
    );

    if (!task) {
        // Fallback for legacy editing projects
        task = await EditProject.findOneAndUpdate(
            { editId: taskId },
            { $set: updateData },
            { new: true }
        );
    }

    if (!task) {
        throw new ApiError(404, "Editing task or project not found");
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
    const { shoot_id, lead_id, client_name, email_id, client_email, data_link, service_type, tasks } = req.body;
    
    if (!shoot_id || !data_link || !Array.isArray(tasks) || tasks.length === 0) {
        throw new ApiError(400, "Shoot ID, data link, and at least one task are required");
    }

    const createdTasks = [];
    for (const task of tasks) {
        const newTask = await EditingTask.create({
            taskId: task.task_id || `TSK_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            editId: task.edit_id || `EDIT_${shoot_id}_${Math.floor(Math.random() * 1000)}`,
            shootId: shoot_id,
            leadId: lead_id || "",
            clientName: client_name || task.client_name || "",
            emailId: email_id || client_email || "",
            serviceType: service_type || task.service_type || "",
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



// --- N8N Dedicated Endpoints ---

const createProject = asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.editId || !body.leadId) {
        throw new ApiError(400, "Edit ID and Lead ID are required");
    }
    const project = await EditProject.create(body);
    return res.status(201).json(new ApiResponse(201, { project }, "Project created"));
});

const getProjects = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.final_delivered) filter.finalDelivered = req.query.final_delivered === 'true';
    if (req.query.deadline_notified) filter.deadlineNotified = req.query.deadline_notified === 'true';
    
    const projects = await EditProject.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, { projects }, "Projects fetched"));
});

const getProjectById = asyncHandler(async (req, res) => {
    const { edit_id } = req.params;
    const project = await EditProject.findOne({ editId: edit_id });
    if (!project) throw new ApiError(404, "Project not found");
    return res.status(200).json(new ApiResponse(200, { project }, "Project fetched"));
});

const updateProject = asyncHandler(async (req, res) => {
    const { edit_id } = req.params;
    const project = await EditProject.findOneAndUpdate(
        { editId: edit_id },
        { $set: req.body },
        { new: true }
    );
    if (!project) throw new ApiError(404, "Project not found");
    return res.status(200).json(new ApiResponse(200, { project }, "Project updated"));
});

const createTask = asyncHandler(async (req, res) => {
    const rawBody = req.body;
    
    // Map snake_case from N8N to camelCase for Mongoose
    const body = {
        taskId: rawBody.taskId || rawBody.task_id,
        editId: rawBody.editId || rawBody.edit_id,
        shootId: rawBody.shootId || rawBody.shoot_id || "",
        leadId: rawBody.leadId || rawBody.lead_id || "UNKNOWN_LEAD",
        clientName: rawBody.clientName || rawBody.client_name || "",
        emailId: rawBody.emailId || rawBody.clientEmail || rawBody.client_email || rawBody.email_id || "",
        serviceType: rawBody.serviceType || rawBody.service_type || "",
        taskType: rawBody.taskType || rawBody.task_type || "",
        taskLabel: rawBody.taskLabel || rawBody.task_label || "",
        dataLink: rawBody.dataLink || rawBody.data_link || "",
        assignedToName: rawBody.assignedToName || rawBody.assigned_to_name || "",
        assignedToEmail: rawBody.assignedToEmail || rawBody.assigned_to_email || "",
        status: rawBody.status || "Assigned",
        managerComment: rawBody.managerComment || rawBody.manager_comment || "",
        deadlineAt: rawBody.deadlineAt || rawBody.deadline_at || "",
        assignedAt: rawBody.assignedAt || rawBody.assigned_at || new Date().toISOString()
    };

    if (!body.taskId || !body.editId) {
        throw new ApiError(400, "Task ID and Edit ID are required");
    }

    // Auto-create EditProject if it doesn't exist (using upsert to prevent race conditions during bulk N8N inserts)
    await EditProject.findOneAndUpdate(
        { editId: body.editId },
        {
            $setOnInsert: {
                shootId: body.shootId,
                leadId: body.leadId,
                clientName: body.clientName,
                emailId: body.emailId,
                serviceType: body.serviceType,
                dataLink: body.dataLink,
                status: "Editing",
                editStartDate: new Date().toISOString().split('T')[0],
                assignedAt: body.assignedAt,
                deadlineAt: body.deadlineAt,
                editorName: body.assignedToName,
                editorEmail: body.assignedToEmail,
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const task = await EditingTask.create(body);
    return res.status(201).json(new ApiResponse(201, { task }, "Task created"));
});

const getTaskById = asyncHandler(async (req, res) => {
    const { task_id } = req.params;
    const task = await EditingTask.findOne({ taskId: task_id });
    if (!task) throw new ApiError(404, "Task not found");
    return res.status(200).json(new ApiResponse(200, { task }, "Task fetched"));
});

const updateTaskById = asyncHandler(async (req, res) => {
    const { task_id } = req.params;
    const updates = { ...req.body };
    
    const task = await EditingTask.findOne({ taskId: task_id });
    if (!task) throw new ApiError(404, "Task not found");

    if (updates.assignedToEmail && updates.assignedToEmail !== task.assignedToEmail) {
        const historyEntry = {
            previousEditorName: task.assignedToName,
            previousEditorEmail: task.assignedToEmail,
            newEditorName: updates.assignedToName,
            newEditorEmail: updates.assignedToEmail,
            reallocatedAt: new Date().toISOString(),
            reason: updates.reallocationReason || "Reassigned by manager"
        };
        const currentHistory = Array.isArray(task.allocationHistory) ? task.allocationHistory : [];
        updates.allocationHistory = [...currentHistory, historyEntry];
    }

    if (updates.managerComment === "" || updates.managerComment === undefined) {
        delete updates.managerComment;
    }

    const updated = await EditingTask.findOneAndUpdate(
        { taskId: task_id },
        { $set: updates },
        { new: true }
    );

    return res.status(200).json(new ApiResponse(200, { task: updated }, "Task updated"));
});

const createRevision = asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.projectId) throw new ApiError(400, "Project ID is required");
    
    const revision = await Revision.create({
        ...body,
        timestamp: new Date().toISOString()
    });
    return res.status(201).json(new ApiResponse(201, { revision }, "Revision created"));
});

export { getEditingData, updateTask, addRevision, assignTasks, createProject, getProjects, getProjectById, updateProject, createTask, getTaskById, updateTaskById, createRevision };
