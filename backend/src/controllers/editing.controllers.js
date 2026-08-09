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

    const shootIds = [...new Set([...editProjects.map(p => p.shootId), ...editingTasks.map(t => t.shootId)])].filter(Boolean);
    const { Shoot } = await import("../models/shoot.models.js");
    const shoots = await Shoot.find({ shootId: { $in: shootIds } });
    const shootMap = {};
    shoots.forEach(s => {
        shootMap[s.shootId] = {
            shootDate: s.shootDate,
            shootStartTime: s.shootStartTime,
            shootEndTime: s.shootEndTime
        };
    });

    const formattedProjects = editProjects.map(p => {
        const obj = p.toObject ? p.toObject() : p;
        obj.id = p._id ? p._id.toString() : obj._id;
        if (obj.shootId && shootMap[obj.shootId]) {
            obj.shootDate = shootMap[obj.shootId].shootDate;
            obj.shootStartTime = shootMap[obj.shootId].shootStartTime;
            obj.shootEndTime = shootMap[obj.shootId].shootEndTime;
        }
        return obj;
    });

    const formattedTasks = editingTasks.map(t => {
        const obj = t.toObject ? t.toObject() : t;
        obj.id = t._id ? t._id.toString() : obj._id;
        if (obj.shootId && shootMap[obj.shootId]) {
            obj.shootDate = shootMap[obj.shootId].shootDate;
            obj.shootStartTime = shootMap[obj.shootId].shootStartTime;
            obj.shootEndTime = shootMap[obj.shootId].shootEndTime;
        }
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

    // Persist the manager-provided footage link on the shoot record when it isn't set yet
    // (editing-only projects are assigned without any prior footage upload).
    const { Shoot } = await import("../models/shoot.models.js");
    await Shoot.findOneAndUpdate(
        { shootId: shoot_id, dataLink: { $in: ["", null] } },
        { $set: { dataLink: data_link } }
    );

    const createdTasks = [];
    const typeCounters = {};
    for (const task of tasks) {
        let label = task.task_label || "";
        if (label.endsWith('#1')) {
            if (typeCounters[task.task_type] === undefined) {
                typeCounters[task.task_type] = await EditingTask.countDocuments({ shootId: shoot_id, taskType: task.task_type });
            }
            if (typeCounters[task.task_type] > 0) {
                label = label.replace(/#1$/, `#${typeCounters[task.task_type] + 1}`);
            }
            typeCounters[task.task_type]++;
        }

        const newTask = await EditingTask.create({
            taskId: task.task_id || `TSK_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            editId: task.edit_id || `EDIT_${shoot_id}_${Math.floor(Math.random() * 1000)}`,
            shootId: shoot_id,
            leadId: lead_id || "",
            clientName: client_name || task.client_name || "",
            emailId: email_id || client_email || "",
            serviceType: service_type || task.service_type || "",
            taskType: task.task_type || "",
            taskLabel: label,
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

    // TAT Reminder: Auto-set timestamps on status transitions
    if (updates.status === 'Draft Sent' && !updates.draftSentToClientAt) {
        updates.draftSentToClientAt = new Date().toISOString();
        updates.clientResponseReminderLevel = 0; // Reset reminders for new draft
        updates.clientApprovalReminderLevel = 0;
    }
    if (updates.status === 'Client Satisfied') {
        updates.clientSatisfiedAt = new Date().toISOString();
    }
    if (updates.status === 'In Progress' && updates.revisionCount !== undefined) {
        // Client requested revision — mark the review timestamp
        updates.clientReviewedAt = new Date().toISOString();
    }

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

    // Fix N8N overriding labels with #1 by appending the correct index
    if (body.taskLabel && body.taskLabel.endsWith('#1')) {
        const existingCount = await EditingTask.countDocuments({ 
            shootId: body.shootId, 
            taskType: body.taskType 
        });
        if (existingCount > 0) {
            body.taskLabel = body.taskLabel.replace(/#1$/, `#${existingCount + 1}`);
        }
    }

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

    // TAT Reminder: Auto-set timestamps on status transitions
    if (updates.status === 'Draft Sent' && !task.draftSentToClientAt) {
        updates.draftSentToClientAt = new Date().toISOString();
        updates.clientResponseReminderLevel = 0;
        updates.clientApprovalReminderLevel = 0;
    } else if (updates.status === 'Draft Sent' && task.draftSentToClientAt) {
        // Re-sending draft (after corrections) — update timestamp and reset client response reminders
        updates.draftSentToClientAt = new Date().toISOString();
        updates.clientResponseReminderLevel = 0;
    }
    if (updates.status === 'Client Satisfied') {
        updates.clientSatisfiedAt = new Date().toISOString();
    }
    if (updates.status === 'In Progress' && task.status === 'Draft Sent') {
        // Client requested revision — mark the review timestamp
        updates.clientReviewedAt = new Date().toISOString();
    }
    // When editor starts work (status changes from Assigned to In Progress), reset editor start reminders
    if (updates.status === 'In Progress' && task.status === 'Assigned') {
        updates.editorStartReminderLevel = 0;
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
    
    const activeProjectStatuses = ['Editing', 'Extra Revision Approved', 'Revision Requested', 'Draft Sent', 'Draft Ready', 'Correction Requested'];
    const activeTaskStatuses = ['Assigned', 'In Progress', 'Editing', 'Extra Revision Approved', 'Revision Requested', 'Draft Sent', 'Draft Ready', 'Correction Requested'];
    
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

// --- TAT Reminder System ---

/**
 * GET /api/v1/editing/reminder-candidates?type=manager_allocation|editor_start|client_response|client_approval
 * Returns tasks/projects that are eligible for reminders based on elapsed time.
 * n8n calls this hourly to find items that need reminder emails.
 */
const getReminderCandidates = asyncHandler(async (req, res) => {
    const { type } = req.query;
    if (!type) throw new ApiError(400, "Query parameter 'type' is required");

    const now = new Date();
    let candidates = [];

    if (type === 'manager_allocation') {
        // R1: Shoots where dataLink is uploaded but no editing tasks have been assigned yet.
        // We look for shoots with driveLinkUploaded=true that have NO corresponding EditingTask.
        const { Shoot } = await import("../models/shoot.models.js");
        const shoots = await Shoot.find({ driveLinkUploaded: true });
        
        for (const shoot of shoots) {
            // Check if any editing tasks exist for this shoot
            const taskCount = await EditingTask.countDocuments({ shootId: shoot.shootId });
            if (taskCount > 0) continue; // Editor already allocated

            // Calculate hours since the shoot's dataLink was shared
            const sharedAt = shoot.updatedAt || shoot.createdAt;
            const hoursElapsed = (now - sharedAt) / (1000 * 60 * 60);
            const currentLevel = shoot.managerAllocationReminderLevel || 0;

            // Determine which reminder level should fire
            let targetLevel = 0;
            if (hoursElapsed >= 48) targetLevel = 4;
            else if (hoursElapsed >= 32) targetLevel = 3;
            else if (hoursElapsed >= 28) targetLevel = 2;
            else if (hoursElapsed >= 24) targetLevel = 1;

            if (targetLevel > currentLevel) {
                // Look up client info for the email
                const client = await Client.findOne({ leadId: shoot.leadId });
                candidates.push({
                    shootId: shoot.shootId,
                    leadId: shoot.leadId,
                    clientName: shoot.clientName || client?.name || '',
                    clientEmail: shoot.clientEmailId || client?.clientEmail || '',
                    dataLink: shoot.dataLink || '',
                    assignedTo: shoot.assignedTo || client?.assignedTo || '',
                    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
                    currentLevel,
                    targetLevel
                });
            }
        }
    }

    else if (type === 'editor_start') {
        // R2: Editor assigned but status still "Assigned" (hasn't started working)
        const tasks = await EditingTask.find({ 
            status: 'Assigned',
            finalDelivered: false
        });

        for (const task of tasks) {
            const assignedAt = task.assignedAt ? new Date(task.assignedAt) : task.createdAt;
            const hoursElapsed = (now - assignedAt) / (1000 * 60 * 60);
            const currentLevel = task.editorStartReminderLevel || 0;

            let targetLevel = 0;
            if (hoursElapsed >= 72) targetLevel = 4;
            else if (hoursElapsed >= 60) targetLevel = 3;
            else if (hoursElapsed >= 48) targetLevel = 2;
            else if (hoursElapsed >= 32) targetLevel = 1;

            if (targetLevel > currentLevel) {
                candidates.push({
                    taskId: task.taskId,
                    editId: task.editId,
                    shootId: task.shootId,
                    leadId: task.leadId,
                    clientName: task.clientName,
                    taskLabel: task.taskLabel,
                    serviceType: task.serviceType,
                    assignedToName: task.assignedToName,
                    assignedToEmail: task.assignedToEmail,
                    assignedAt: task.assignedAt,
                    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
                    currentLevel,
                    targetLevel
                });
            }
        }
    }

    else if (type === 'client_response') {
        // R3: Draft sent to client but no response (no "Satisfied" or "Not Satisfied" click)
        // Look for tasks/projects with status "Draft Sent" and draftSentToClientAt set
        const tasks = await EditingTask.find({ 
            status: 'Draft Sent',
            finalDelivered: false,
            draftSentToClientAt: { $ne: '' }
        });

        for (const task of tasks) {
            const sentAt = new Date(task.draftSentToClientAt);
            const hoursElapsed = (now - sentAt) / (1000 * 60 * 60);
            const currentLevel = task.clientResponseReminderLevel || 0;

            let targetLevel = 0;
            if (hoursElapsed >= 72) targetLevel = 3;
            else if (hoursElapsed >= 48) targetLevel = 2;
            else if (hoursElapsed >= 24) targetLevel = 1;

            if (targetLevel > currentLevel) {
                // Look up assigned salesperson from client record
                const client = await Client.findOne({ leadId: task.leadId });
                candidates.push({
                    taskId: task.taskId,
                    editId: task.editId,
                    leadId: task.leadId,
                    clientName: task.clientName,
                    clientEmail: task.emailId || client?.clientEmail || '',
                    taskLabel: task.taskLabel,
                    serviceType: task.serviceType,
                    assignedToName: task.assignedToName,
                    assignedSalesperson: client?.assignedTo || '',
                    draftSentToClientAt: task.draftSentToClientAt,
                    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
                    currentLevel,
                    targetLevel
                });
            }
        }

        // Also check EditProject (legacy)
        const projects = await EditProject.find({
            status: 'Draft Sent',
            finalDelivered: false,
            draftSentToClientAt: { $ne: '' }
        });

        for (const project of projects) {
            const sentAt = new Date(project.draftSentToClientAt);
            const hoursElapsed = (now - sentAt) / (1000 * 60 * 60);
            const currentLevel = project.clientResponseReminderLevel || 0;

            let targetLevel = 0;
            if (hoursElapsed >= 72) targetLevel = 3;
            else if (hoursElapsed >= 48) targetLevel = 2;
            else if (hoursElapsed >= 24) targetLevel = 1;

            if (targetLevel > currentLevel) {
                const client = await Client.findOne({ leadId: project.leadId });
                candidates.push({
                    editId: project.editId,
                    leadId: project.leadId,
                    clientName: project.clientName,
                    clientEmail: project.emailId || client?.clientEmail || '',
                    serviceType: project.serviceType,
                    editorName: project.editorName,
                    assignedSalesperson: client?.assignedTo || '',
                    draftSentToClientAt: project.draftSentToClientAt,
                    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
                    currentLevel,
                    targetLevel,
                    isProject: true
                });
            }
        }
    }

    else if (type === 'client_approval') {
        // R4: Client has reviewed (clicked Not Satisfied, corrections were made and sent back)
        // but client hasn't confirmed final OK yet.
        // Look for tasks with status "Draft Sent" and clientReviewedAt set (meaning this is a re-sent draft after corrections)
        const tasks = await EditingTask.find({
            status: 'Draft Sent',
            finalDelivered: false,
            clientReviewedAt: { $ne: '' },
            clientSatisfiedAt: ''
        });

        for (const task of tasks) {
            const reviewedAt = new Date(task.clientReviewedAt);
            const hoursElapsed = (now - reviewedAt) / (1000 * 60 * 60);
            const currentLevel = task.clientApprovalReminderLevel || 0;

            let targetLevel = 0;
            if (hoursElapsed >= 48) targetLevel = 2;
            else if (hoursElapsed >= 24) targetLevel = 1;

            if (targetLevel > currentLevel) {
                const client = await Client.findOne({ leadId: task.leadId });
                candidates.push({
                    taskId: task.taskId,
                    editId: task.editId,
                    leadId: task.leadId,
                    clientName: task.clientName,
                    clientEmail: task.emailId || client?.clientEmail || '',
                    taskLabel: task.taskLabel,
                    serviceType: task.serviceType,
                    assignedSalesperson: client?.assignedTo || '',
                    clientReviewedAt: task.clientReviewedAt,
                    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
                    currentLevel,
                    targetLevel
                });
            }
        }
    }

    else {
        throw new ApiError(400, "Invalid reminder type. Use: manager_allocation, editor_start, client_response, client_approval");
    }

    return res.status(200).json(new ApiResponse(200, { candidates, type }, `Reminder candidates fetched for type: ${type}`));
});

/**
 * PUT /api/v1/editing/reminder-level
 * Updates the reminder level for a task/project after n8n sends the reminder email.
 * Body: { id, field, level, idType: "taskId"|"editId"|"shootId" }
 */
const updateReminderLevel = asyncHandler(async (req, res) => {
    const { id, field, level, idType } = req.body;
    
    if (!id || !field || level === undefined) {
        throw new ApiError(400, "id, field, and level are required");
    }

    const validFields = [
        'managerAllocationReminderLevel',
        'editorStartReminderLevel', 
        'clientResponseReminderLevel',
        'clientApprovalReminderLevel'
    ];
    if (!validFields.includes(field)) {
        throw new ApiError(400, `Invalid field. Use: ${validFields.join(', ')}`);
    }

    let updated = null;

    if (idType === 'shootId') {
        // R1: Update the Shoot document directly (EditProject may not exist yet)
        const { Shoot } = await import("../models/shoot.models.js");
        updated = await Shoot.findOneAndUpdate(
            { shootId: id },
            { $set: { [field]: level } },
            { new: true }
        );
    } else if (idType === 'editId') {
        // Try EditProject first, then EditingTask
        updated = await EditProject.findOneAndUpdate(
            { editId: id },
            { $set: { [field]: level } },
            { new: true }
        );
        if (!updated) {
            updated = await EditingTask.findOneAndUpdate(
                { editId: id },
                { $set: { [field]: level } },
                { new: true }
            );
        }
    } else {
        // Default: try taskId first, then editId
        updated = await EditingTask.findOneAndUpdate(
            { taskId: id },
            { $set: { [field]: level } },
            { new: true }
        );
        if (!updated) {
            updated = await EditProject.findOneAndUpdate(
                { editId: id },
                { $set: { [field]: level } },
                { new: true }
            );
        }
    }

    if (!updated) {
        throw new ApiError(404, "Task or Project not found for reminder update");
    }

    return res.status(200).json(new ApiResponse(200, { updated }, "Reminder level updated"));
});

export { getEditingData, getEditorWorkload, updateTask, addRevision, assignTasks, createProject, getProjects, getProjectById, updateProject, createTask, getTaskById, updateTaskById, createRevision, getReminderCandidates, updateReminderLevel };
