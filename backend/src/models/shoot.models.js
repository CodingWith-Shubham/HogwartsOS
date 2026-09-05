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
    deliverableSetIndex: { type: Number, default: 0 },
    deliverable_set_index: { type: Number },
    // When set, this shoot belongs to a UpsellCrossSell pipeline entry —
    // NOT to the original client/lead pipeline. Shoot conflict detection and
    // addon payment tagging use this to isolate upsell shoots from original ones.
    upsellCrossSellId: {
        type: String,
        default: "",
        index: true
    },
    // ── Tentative Booking System ──────────────────────────────────────────────
    // bookingStatus tracks whether this shoot slot is a tentative hold or a
    // confirmed booking. Default is 'confirmed' so all pre-existing shoots in
    // the database are treated as confirmed without any migration.
    //
    //  tentative  – Slot held for client but NOT yet calendar-confirmed.
    //               Multiple clients may hold the same room+time tentatively.
    //               n8n does NOT send a calendar invite for tentative holds.
    //
    //  confirmed  – First-payment winner; n8n sends calendar invite.
    //               This is also the default for any shoot booked via the
    //               original "Schedule Shoot" (non-tentative) button.
    //
    //  conflict   – Auto-set on losing tentative holds when another client's
    //               payment verified first for the same room+slot.
    //
    //  cancelled  – Manually cancelled by staff (soft-delete). The document
    //               is kept for audit purposes but hidden from active views.
    bookingStatus: {
        type: String,
        enum: ['tentative', 'confirmed', 'conflict', 'cancelled'],
        default: 'confirmed',
        index: true
    },
    bookingStatusNote: {
        type: String,
        default: ''
    }
}, { timestamps: true });

export const Shoot = mongoose.model("Shoot", shootSchema);
