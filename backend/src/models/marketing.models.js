import mongoose, { Schema } from "mongoose";

const marketingTaskSchema = new Schema({
    taskId: {
        type: String,
        required: true,
        unique: true,
        index: true
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
    months: {
        type: String,
        default: ""
    },
    posts: {
        type: String,
        default: ""
    },
    socialMediaHandles: {
        type: String,
        default: ""
    },
    marketingNotes: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        default: "Unassigned" // Unassigned -> Assigned -> In Progress -> Completed
    },
    assignedToName: {
        type: String,
        default: ""
    },
    assignedToEmail: {
        type: String,
        default: ""
    },
    assignedAt: {
        type: String,
        default: ""
    },
    completedAt: {
        type: String,
        default: ""
    },
    clientProfile: { 
        type: Schema.Types.ObjectId, 
        ref: "ClientProfile" 
    },
}, { timestamps: true });

export const MarketingTask = mongoose.model("MarketingTask", marketingTaskSchema);
