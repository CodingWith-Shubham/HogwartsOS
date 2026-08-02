import { EditProject, EditingTask } from "../models/editing.models.js";
import { Revision } from "../models/revision.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Client } from "../models/client.models.js";
import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/async-handler.js";

const getEditingData = asyncHandler(async (req, res) => {
    const taskFilter = {};
    if (req.query.editorEmail) taskFilter.assignedToEmail = req.query.editorEmail;

    let editProjects = await EditProject.find({}).sort({ createdAt: -1 });
    let editingTasks = await EditingTask.find(taskFilter).sort({ createdAt: -1 });
    let revisions = await Revision.find({}).sort({ createdAt: -1 });

    const user = req.user;
    if (user && user.role === 'editor') {
        const uemail = user.email?.trim().toLowerCase();
        const uname = user.name?.trim().toLowerCase();
        
        editingTasks = editingTasks.filter(task => {
            const email = (task.assignedToEmail || '').trim().toLowerCase();
            const name = (task.assignedToName || '').trim().toLowerCase();
            const emailMatch = email && uemail && email === uemail;
            const nameMatch = name && uname && name === uname;
            return emailMatch || nameMatch;
        });
        
        editProjects = editProjects.filter(project => {
            const email = (project.editorEmail || '').trim().toLowerCase();
            const name = (project.editorName || '').trim().toLowerCase();
            const emailMatch = email && uemail && email === uemail;
            const nameMatch = name && uname && name === uname;
            return emailMatch || nameMatch;
        });
        
        const allowedProjectIds = new Set([
            ...editProjects.map(p => p.editId),
            ...editingTasks.map(t => t.taskId)
        ]);
        revisions = revisions.filter(rev => allowedProjectIds.has(rev.projectId));
    } else if (user && user.role === 'sales') {
        const uname = user.name?.trim().toLowerCase();
        const uemail = user.email?.trim().toLowerCase();
        const uusername = user.username?.trim().toLowerCase();
        
        const allowedLeads = await Client.find({});
        const myLeadIds = new Set(allowedLeads.filter(lead => {
            const assigned = (lead.assignedTo || '').trim().toLowerCase();
            return assigned === uname || assigned === uemail || assigned === uusername;
        }).map(l => l.leadId));
        
        editingTasks = editingTasks.filter(task => myLeadIds.has(task.leadId));
        editProjects = editProjects.filter(project => myLeadIds.has(project.leadId));
        
        const allowedProjectIds = new Set([
            ...editProjects.map(p => p.editId),
            ...editingTasks.map(t => t.taskId)
        ]);
        revisions = revisions.filter(rev => allowedProjectIds.has(rev.projectId));
    } else if (user && user.role === 'admin' && req.query.managerView !== 'true') {
        const uname = user.name?.trim().toLowerCase();
        const uemail = user.email?.trim().toLowerCase();
        const uusername = user.username?.trim().toLowerCase();
        
        const allowedLeads = await Client.find({});
        const myLeadIds = new Set(allowedLeads.filter(lead => {
            const assigned = (lead.assignedTo || '').trim().toLowerCase();
            return assigned === uname || assigned === uemail || assigned === uusername;
        }).map(l => l.leadId));
        
        editingTasks = editingTasks.filter(task => myLeadIds.has(task.leadId));
        editProjects = editProjects.filter(project => myLeadIds.has(project.leadId));
        
        const allowedProjectIds = new Set([
            ...editProjects.map(p => p.editId),
            ...editingTasks.map(t => t.taskId)
        ]);
        revisions = revisions.filter(rev => allowedProjectIds.has(rev.projectId));
    }

    const formattedProjects = editProjects.map(p => {
        const obj = p.toObject ? p.toObject() : p;
        obj.id = p._id ? p._id.toString() : obj._id;
        return obj;
    });

    const formattedTasks = editingTasks.map(t => {
        const obj = t.toObject ? t.toObject() : t;
        obj.id = t._id ? t._id.toString() : obj._id;
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

    if (updateData.managerComment === undefined) {
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

    // If a task is marked as Completed, check if all sibling tasks are Completed
    if (updateData.status === 'Completed' && task.editId && task.taskId) {
        const siblingTasks = await EditingTask.find({ editId: task.editId });
        const allCompleted = siblingTasks.every(t => t.status === 'Completed');
        if (allCompleted) {
            await EditProject.findOneAndUpdate(
                { editId: task.editId },
                { $set: { status: 'Completed' } }
            );
        }
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
    let project = await EditProject.findOne({ editId: edit_id });
    if (!project) {
        project = await EditingTask.findOne({ taskId: edit_id });
    }
    if (!project) throw new ApiError(404, "Project or Task not found");
    
    // Attach snake_case aliases for N8N compatibility
    const projectData = project.toObject();
    projectData.revision_count = projectData.revisionCount;
    projectData.max_free_revisions = projectData.maxFreeRevisions;
    projectData.current_draft_link = projectData.draftLink || projectData.currentDraftLink;
    
    return res.status(200).json(new ApiResponse(200, { project: projectData }, "Project fetched"));
});

const updateProject = asyncHandler(async (req, res) => {
    const { edit_id } = req.params;
    const updates = { ...req.body };
    
    // Map N8N snake_case fields to Mongoose camelCase
    if (updates.revision_count !== undefined) updates.revisionCount = Number(updates.revision_count);
    if (updates.current_draft_link !== undefined) {
        updates.draftLink = updates.current_draft_link;
        updates.currentDraftLink = updates.current_draft_link;
    }
    if (updates.deadline_notified !== undefined) updates.deadlineNotified = updates.deadline_notified === 'true' || updates.deadline_notified === true;
    if (updates.final_delivered !== undefined) updates.finalDelivered = updates.final_delivered === 'true' || updates.final_delivered === true;
    if (updates.extra_revision_approved !== undefined) updates.extraRevisionApproved = updates.extra_revision_approved === 'true' || updates.extra_revision_approved === true;
    if (updates.extra_revision_cost !== undefined) updates.extraRevisionCost = updates.extra_revision_cost;
    if (updates.handover_to_client !== undefined) updates.handoverToClient = updates.handover_to_client;

    // Fetch the project first to check maxFreeRevisions
    let projectToUpdate = await EditProject.findOne({ editId: edit_id });
    if (!projectToUpdate) {
        projectToUpdate = await EditingTask.findOne({ taskId: edit_id });
    }
    if (!projectToUpdate) throw new ApiError(404, "Project or Task not found");

    // Automatically enforce Revision Requested status if exceeding free revisions
    if (updates.revisionCount !== undefined && updates.revisionCount > (projectToUpdate.maxFreeRevisions || 2)) {
        updates.status = 'Revision Requested';
        updates.extraRevisionApproved = false; // Reset approval
    }

    if (updates.managerComment === undefined) {
        delete updates.managerComment;
    }

    let project = await EditProject.findOneAndUpdate(
        { editId: edit_id },
        { $set: updates },
        { new: true }
    );
    if (!project) {
        project = await EditingTask.findOneAndUpdate(
            { taskId: edit_id },
            { $set: updates },
            { new: true }
        );
    }
    if (!project) throw new ApiError(404, "Project or Task not found");
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
    const taskData = task.toObject();
    taskData.revision_count = taskData.revisionCount;
    taskData.max_free_revisions = taskData.maxFreeRevisions;
    taskData.current_draft_link = taskData.draftLink;

    return res.status(200).json(new ApiResponse(200, { task: taskData }, "Task fetched"));
});

const updateTaskById = asyncHandler(async (req, res) => {
    const { task_id } = req.params;
    const updates = { ...req.body };
    
    // Map N8N snake_case fields to Mongoose camelCase
    if (updates.assigned_to_name !== undefined) updates.assignedToName = updates.assigned_to_name;
    if (updates.assigned_to_email !== undefined) updates.assignedToEmail = updates.assigned_to_email;
    if (updates.previous_editor_name !== undefined) updates.previousEditorName = updates.previous_editor_name;
    if (updates.previous_editor_email !== undefined) updates.previousEditorEmail = updates.previous_editor_email;
    if (updates.reallocation_reason !== undefined) updates.reallocationReason = updates.reallocation_reason;
    if (updates.allocation_history !== undefined) {
        try {
            updates.allocationHistory = typeof updates.allocation_history === 'string' ? JSON.parse(updates.allocation_history) : updates.allocation_history;
        } catch(e) {}
    }

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

    if (updates.managerComment === undefined) {
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

const getEditorWorkload = asyncHandler(async (req, res) => {
    const editors = await User.find({ role: 'editor' });
    
    const activeProjectStatuses = ['Editing', 'Extra Revision Approved', 'Revision Requested', 'Draft Sent', 'Draft Ready'];
    const activeTaskStatuses = ['Assigned', 'In Progress', 'Editing', 'Extra Revision Approved', 'Revision Requested', 'Draft Sent', 'Draft Ready'];
    
    const activeProjects = await EditProject.find({ status: { $in: activeProjectStatuses } });
    const activeTasks = await EditingTask.find({ status: { $in: activeTaskStatuses } });

    const workloads = editors.map(editor => {
        const editorName = (editor.name || "").trim().toLowerCase();
        
        const myProjects = activeProjects.filter(p => (p.editorName || "").trim().toLowerCase() === editorName);
        const myTasks = activeTasks.filter(t => (t.assignedToName || "").trim().toLowerCase() === editorName);

        const values = {
            podcastDraft: 0,
            podcastEdit: 0,
            reelDraft: 0,
            reelEdit: 0,
            longFormatVideo: 0,
            teaserDemo: 0,
            teaser: 0,
            thumbnail: 0
        };

        const normalizeQuantity = (val) => {
            if (!val) return 0;
            const parsed = parseInt(String(val).replace(/\D/g, ''), 10);
            return isNaN(parsed) ? 0 : parsed;
        };

        myProjects.forEach(p => {
            values.podcastDraft += normalizeQuantity(p.podcastDraft);
            values.podcastEdit += normalizeQuantity(p.podcastEdit);
            values.reelDraft += normalizeQuantity(p.reelDraft);
            values.reelEdit += normalizeQuantity(p.reel || p.reelDraft);
            values.longFormatVideo += normalizeQuantity(p.longFormatVideo);
            values.teaserDemo += normalizeQuantity(p.teaserDemo);
            values.teaser += normalizeQuantity(p.teaser);
            values.thumbnail += normalizeQuantity(p.thumbnail);
        });

        myTasks.forEach(t => {
            const tType = t.taskType || "";
            if (tType === 'podcast_edit') values.podcastEdit += 1;
            else if (tType === 'teaser_edit') values.teaser += 1;
            else if (tType === 'reel_edit' || tType === 'short_format_video') values.reelEdit += 1;
            else if (tType === 'thumbnail_edit') values.thumbnail += 1;
            else if (tType === 'long_format_video') values.longFormatVideo += 1;
        });

        const mappedTaskTypes = ['podcast_edit', 'teaser_edit', 'reel_edit', 'short_format_video', 'thumbnail_edit', 'long_format_video'];
        const unmappedTasksCount = myTasks.filter(t => !mappedTaskTypes.includes(t.taskType)).length;
        
        const totalDeliverables = Object.values(values).reduce((sum, val) => sum + val, 0) + unmappedTasksCount;

        return {
            editorName: editor.name,
            activeProjects: myProjects.length + myTasks.length,
            totalDeliverables,
            podcastDraft: String(values.podcastDraft),
            podcastEdit: String(values.podcastEdit),
            reelDraft: String(values.reelDraft),
            reelEdit: String(values.reelEdit),
            longFormatVideo: String(values.longFormatVideo),
            teaserDemo: String(values.teaserDemo),
            teaser: String(values.teaser),
            thumbnail: String(values.thumbnail)
        };
    });

    return res.status(200).json(new ApiResponse(200, { workloads }, "Editor workload fetched successfully"));
});

export { getEditingData, getEditorWorkload, updateTask, addRevision, assignTasks, createProject, getProjects, getProjectById, updateProject, createTask, getTaskById, updateTaskById, createRevision };
