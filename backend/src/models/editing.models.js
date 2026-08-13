import mongoose, { Schema } from "mongoose";

const editProjectSchema = new Schema({
    editId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    shootId: {
        type: String,
        default: ""
    },
    leadId: {
        type: String,
        required: true,
        index: true
    },
    clientName: {
        type: String,
        default: ""
    },
    month: {
        type: String,
        default: ""
    },
    editStartDate: {
        type: String,
        default: ""
    },
    editDeliveryDate: {
        type: String,
        default: ""
    },
    podcastDraft: { type: String, default: "" },
    podcastEdit: { type: String, default: "0" },
    longFormatVideo: { type: String, default: "0" },
    reelDraft: { type: String, default: "" },
    reel: { type: String, default: "0" },
    teaserDemo: { type: String, default: "" },
    teaser: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    dataLink: { type: String, default: "" },
    status: { type: String, default: "In Progress" },
    totalService: { type: String, default: "" },
    editorComment: { type: String, default: "" },
    emailId: { type: String, default: "" },
    handoverToClient: { type: String, default: "" },
    editorName: { type: String, default: "" },
    editorEmail: { type: String, default: "" },
    serviceType: { type: String, default: "" },
    revisionCount: { type: Number, default: 0 },
    maxFreeRevisions: { type: Number, default: 2 },
    extraRevisionApproved: { type: Boolean, default: false },
    extraRevisionCost: { type: String, default: "0" },
    currentDraftLink: { type: String, default: "" },
    assignedAt: { type: String, default: "" },
    deadlineAt: { type: String, default: "" },
    deadlineNotified: { type: String, default: "false" },
    finalDelivered: { type: Boolean, default: false },
    reelEdit: { type: String, default: "0" },
    managerComment: { type: String, default: "" },

    // TAT Reminder tracking timestamps
    dataLinkSharedAt: { type: String, default: "" },
    draftSentToClientAt: { type: String, default: "" },
    clientReviewedAt: { type: String, default: "" },
    clientSatisfiedAt: { type: String, default: "" },

    // Client Profile reference
    clientProfile: { type: Schema.Types.ObjectId, ref: "ClientProfile" },

    // TAT Reminder level tracking (0=no reminder sent, 1-4=reminder level sent)
    managerAllocationReminderLevel: { type: Number, default: 0 },
    editorStartReminderLevel: { type: Number, default: 0 },
    clientResponseReminderLevel: { type: Number, default: 0 },
    clientApprovalReminderLevel: { type: Number, default: 0 }
}, { timestamps: true });

const editingTaskSchema = new Schema({
    taskId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    editId: {
        type: String,
        required: true,
        index: true
    },
    shootId: {
        type: String,
        default: ""
    },
    leadId: {
        type: String,
        required: true,
        index: true
    },
    clientName: {
        type: String,
        default: ""
    },
    emailId: {
        type: String,
        default: ""
    },
    serviceType: {
        type: String,
        default: ""
    },
    taskType: {
        type: String,
        default: ""
    },
    taskIndex: {
        type: Number,
        default: 1
    },
    taskLabel: {
        type: String,
        default: ""
    },
    dataLink: {
        type: String,
        default: ""
    },
    assignedToName: {
        type: String,
        default: ""
    },
    assignedToEmail: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        default: "Assigned"
    },
    draftLink: {
        type: String,
        default: ""
    },
    managerComment: {
        type: String,
        default: ""
    },
    revisionCount: {
        type: Number,
        default: 0
    },
    maxFreeRevisions: {
        type: Number,
        default: 2
    },
    extraRevisionApproved: {
        type: Boolean,
        default: false
    },
    assignedAt: {
        type: String,
        default: ""
    },
    deadlineAt: {
        type: String,
        default: ""
    },
    deadlineNotified: {
        type: Boolean,
        default: false
    },
    finalDelivered: {
        type: Boolean,
        default: false
    },
    allocationHistory: {
        type: Schema.Types.Mixed,
        default: []
    },
    reallocationReason: {
        type: String,
        default: ""
    },
    previousEditorName: {
        type: String,
        default: ""
    },
    previousEditorEmail: {
        type: String,
        default: ""
    },

    // TAT Reminder tracking timestamps
    dataLinkSharedAt: { type: String, default: "" },
    draftSentToClientAt: { type: String, default: "" },
    clientReviewedAt: { type: String, default: "" },
    clientSatisfiedAt: { type: String, default: "" },

    // TAT Reminder level tracking (0=no reminder sent, 1-4=reminder level sent)
    managerAllocationReminderLevel: { type: Number, default: 0 },
    editorStartReminderLevel: { type: Number, default: 0 },
    clientResponseReminderLevel: { type: Number, default: 0 },
    clientApprovalReminderLevel: { type: Number, default: 0 },

    // Editor comment sent to manager with draft submission
    editorComment: { type: String, default: '' },

    // Correction/Revision segregation tracking
    correctionCount: { type: Number, default: 0 }
}, { timestamps: true });

export const EditProject = mongoose.model("EditProject", editProjectSchema);
export const EditingTask = mongoose.model("EditingTask", editingTaskSchema);
