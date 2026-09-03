import mongoose, { Schema } from "mongoose";

const salesTargetSchema = new Schema(
    {
        salesPersonId: {
            type: String, // Storing Name directly for ease, just like 'Assigned To'
            required: true,
            index: true,
        },
        salesPersonName: {
            type: String,
            required: true,
        },
        period: {
            type: String, // Format: YYYY-MM
            required: true,
            index: true,
        },
        targetAmount: {
            type: Number,
            required: true,
            default: 0,
        },
        targetType: {
            type: String,
            enum: ["revenue", "leads_converted"],
            default: "revenue",
        },
        createdBy: {
            type: String,
        },
    },
    { timestamps: true }
);

// A sales rep can only have one target per period
salesTargetSchema.index({ salesPersonId: 1, period: 1 }, { unique: true });

export const SalesTarget = mongoose.model("SalesTarget", salesTargetSchema);
