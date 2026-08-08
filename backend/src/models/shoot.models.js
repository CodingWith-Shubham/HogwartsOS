import mongoose, { Schema } from "mongoose";

const shootSchema = new Schema({
    shootId: {
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
    contactNum: {
        type: String,
        default: ""
    },
    clientEmailId: {
        type: String,
        default: ""
    },
    shootDate: {
        type: String,
        default: ""
    },
    shootStartTime: {
        type: String,
        default: ""
    },
    shootEndTime: {
        type: String,
        default: ""
    },
    camera: {
        type: String,
        default: "1"
    },
    teleprompter: {
        type: String,
        default: "No"
    },
    totalHours: {
        type: String,
        default: ""
    },
    assignedTo: {
        type: String,
        default: ""
    },
    bts: {
        type: String,
        default: "No"
    },
    shootMemberName: {
        type: String,
        default: ""
    },
    shootMemberEmail: {
        type: String,
        default: ""
    },
    dataLink: {
        type: String,
        default: ""
    },
    driveLinkUploaded: {
        type: Boolean,
        default: false
    },
    // Editing-only flow: set when the lead was pitched "Only editing".
    // These records bypass shoot scheduling entirely and surface directly
    // in the manager dashboard's "Assign Editor" queue once payment is verified.
    isEditingOnly: {
        type: Boolean,
        default: false
    },
    testimonials: {
        type: String,
        default: ""
    },
    recordTime: {
        type: String,
        default: ""
    },
    studioTime: {
        type: String,
        default: ""
    },
    extraCamera: {
        type: String,
        default: "0"
    },
    extraTeleprompter: {
        type: String,
        default: "0"
    },
    extraDurationHours: {
        type: String,
        default: "0"
    },
    additionalCost: {
        type: String,
        default: "0"
    },
    shootNotes: {
        type: String,
        default: ""
    },
    calendarEventId: {
        type: String,
        default: ""
    },
    calendarLink: {
        type: String,
        default: ""
    },
    setName: {
        type: String,
        default: ""
    },
    handoverTo: {
        type: String,
        default: ""
    },
    addonHasAddons: {
        type: String,
        default: "no"
    },
    addonPaymentStatus: {
        type: String,
        default: ""
    },
    addonScreenshot: {
        type: String,
        default: ""
    },
    addonUtr: {
        type: String,
        default: ""
    },
    addonVerifiedBy: {
        type: String,
        default: ""
    },
    addonVerifiedAt: {
        type: String,
        default: ""
    },
    // TAT Reminder: R1 level tracked on Shoot since EditProject may not exist yet
    managerAllocationReminderLevel: { type: Number, default: 0 },
    deliverableSetIndex: { type: Number, default: 0 }
}, { timestamps: true });

export const Shoot = mongoose.model("Shoot", shootSchema);
