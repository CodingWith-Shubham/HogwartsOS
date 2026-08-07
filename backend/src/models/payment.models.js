import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema({
    paymentId: {
        type: String,
        sparse: true
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
    amount: {
        type: Number,
        default: 0
    },
    paymentLinkSent: {
        type: Boolean,
        default: false
    },
    paymentLinkSentAt: {
        type: String,
        default: ""
    },
    screenshotUrl: {
        type: String,
        default: ""
    },
    utrNumber: {
        type: String,
        default: ""
    },
    paymentStatus: {
        type: String,
        default: "Pending"
    },
    verifiedBy: {
        type: String,
        default: ""
    },
    verifiedAt: {
        type: String,
        default: ""
    },
    totalCost: {
        type: Number,
        default: 0
    },
    remainingAmount: {
        type: Number,
        default: 0
    },
    paymentCompleted: {
        type: Boolean,
        default: false
    },
    installmentNumber: {
        type: String,
        default: ""
    },
    installmentLabel: {
        type: String,
        default: ""
    },
    paymentMode: {
        type: String,
        default: "Online"
    },
    cashCollectedBy: {
        type: String,
        default: ""
    },
    amountPaidSoFar: {
        type: Number,
        default: 0
    },
    // When set, this payment belongs to an UpsellCrossSell pipeline entry —
    // NOT to the client's original lead pipeline. Verification/screenshot flows
    // then update the upsell entry instead of the Lead/Client record.
    upsellCrossSellId: {
        type: String,
        default: "",
        index: true
    }
}, { timestamps: true });

export const Payment = mongoose.model("Payment", paymentSchema);
