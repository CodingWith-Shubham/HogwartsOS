import mongoose, { Schema } from "mongoose";

const revisionSchema = new Schema({
    projectId: {
        type: String,
        required: true,
        index: true
    },
    clientName: {
        type: String,
        default: ""
    },
    editorName: {
        type: String,
        default: ""
    },
    revisionRound: {
        type: Number,
        default: 1
    },
    feedback: {
        type: String,
        default: ""
    },
    feedbackGivenBy: {
        type: String,
        default: ""
    },
    feedbackDate: {
        type: String,
        default: ""
    },
    updatedDraftLink: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        default: "Pending"
    },
    timestamp: {
        type: String,
        default: ""
    }
}, { timestamps: true });

export const Revision = mongoose.model("Revision", revisionSchema);
