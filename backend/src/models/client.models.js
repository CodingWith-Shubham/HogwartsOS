import mongoose, { Schema } from "mongoose";

const clientSchema = new Schema({
    leadId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    phoneNumber: {
        type: String,
        default: ""
    },
    leadType: {
        type: String,
        enum: ['lead', 'upsell'],
        default: 'lead',
        index: true
    },
    date: {
        type: String,
        default: ""
    },
    adRefCode: {
        type: String,
        default: ""
    },
    source: {
        type: String,
        default: "Manual Entry"
    },
    assignedTo: {
        type: String,
        default: ""
    },
    name: {
        type: String,
        required: true
    },
    reachoutDone: {
        type: String,
        default: "no"
    },
    servicePitched: {
        type: String,
        default: ""
    },
    cost: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        default: "New Lead"
    },
    clientEmail: {
        type: String,
        default: ""
    },
    proposalSent: {
        type: Boolean,
        default: false
    },
    proposalAccepted: {
        type: Boolean,
        default: false
    },
    proposalSentAt: {
        type: String,
        default: ""
    },
    podcastDraft: { type: String, default: "" },
    podcastEdit: { type: String, default: "0" },
    reelDraft: { type: String, default: "" },
    reelEdit: { type: String, default: "0" },
    longFormatVideo: { type: String, default: "0" },
    teaserDemo: { type: String, default: "" },
    teaser: { type: String, default: "" },
    teaserEdit: { type: String, default: "0" },
    thumbnail: { type: String, default: "" },
    thumbnailEdit: { type: String, default: "0" },
    serviceNotes: { type: String, default: "" },
    camera: { type: String, default: "" },
    recordTime: { type: String, default: "" },
    studioTime: { type: String, default: "" },
    remainingAmount: { type: String, default: "0" },
    shortFormatVideo: { type: String, default: "" },
    longFormatDuration: { type: String, default: "" },
    shortFormatDuration: { type: String, default: "" },
    additionalNotes: { type: String, default: "" },
    salesNotes: { type: String, default: "" },
    proposalRevokeReason: { type: String, default: "" }
}, { timestamps: true });

export const Client = mongoose.model("Client", clientSchema);
