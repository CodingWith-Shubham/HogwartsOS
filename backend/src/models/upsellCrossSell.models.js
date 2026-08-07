import mongoose, { Schema } from "mongoose";

/**
 * Upsell & Cross-Sell pipeline statuses.
 * initiated → proposal_sent → payment_sent → payment_done → shoot_scheduled → shoot_done → editing → delivered
 *
 * Special bypass: for editing-only services (no shoot required),
 * the flow goes payment_done → editing directly (shoot stages skipped).
 */
export const UPSELL_CROSSSELL_STATUSES = [
    "initiated",
    "proposal_sent",
    "payment_sent",
    "payment_done",
    "shoot_scheduled",
    "shoot_done",
    "editing",
    "delivered"
];

/**
 * UpsellCrossSell model — COMPLETELY SEPARATE from the Lead/Client lead pipeline.
 * Documents here must NEVER appear in the sales leads dashboard or lead metrics.
 * It represents a parallel upsell/cross-sell deal initiated from an EXISTING client.
 */
const upsellCrossSellSchema = new Schema({
    clientId: {
        type: Schema.Types.ObjectId,
        ref: "Client",
        required: true,
        index: true
    },
    // Convenience copy of Client.leadId so the parallel pipeline can be
    // cross-referenced without an extra lookup.
    clientLeadId: {
        type: String,
        default: "",
        index: true
    },
    clientName: {
        type: String,
        required: true
    },
    clientPhone: {
        type: String,
        default: ""
    },
    clientEmail: {
        type: String,
        default: ""
    },
    type: {
        type: String,
        enum: ["upsell", "crosssell"],
        required: true,
        index: true
    },
    services: {
        type: [String],
        default: []
    },
    cost: {
        type: Number,
        default: 0
    },
    assignedTo: {
        type: String,
        default: ""
    },
    notes: {
        type: String,
        default: ""
    },
    reachout_done: {
        type: String,
        default: "yes"
    },
    // When true: skip shoot_scheduled / shoot_done and go payment_done → editing.
    // Determined at initiation time from the selected services (or an explicit flag).
    editingOnly: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: UPSELL_CROSSSELL_STATUSES,
        default: "initiated",
        index: true
    },
    proposalLink: {
        type: String,
        default: ""
    },
    paymentLink: {
        type: String,
        default: ""
    },
    shootLink: {
        type: String,
        default: ""
    },
    editorAssigned: {
        type: String,
        default: ""
    }
}, { timestamps: true });

export const UpsellCrossSell = mongoose.model("UpsellCrossSell", upsellCrossSellSchema);
