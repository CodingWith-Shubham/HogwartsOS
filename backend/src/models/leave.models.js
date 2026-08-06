import mongoose, { Schema } from "mongoose";

const leaveSchema = new Schema({
    employeeEmail: { type: String, required: true, lowercase: true, index: true },
    employeeName: { type: String, default: "" },
    leaveType: { type: String, enum: ["Paid", "Sick"], required: true },
    startDate: { type: String, required: true }, // YYYY-MM-DD prevents timezone drift
    endDate: { type: String, required: true },
    totalDays: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending", index: true },
    appliedOn: { type: Date, default: Date.now },
    reviewedBy: String,
    reviewedOn: Date,
    certificateUrl: String,
    certificateFileName: String,
    certificateMimeType: String,
    isRetroactive: { type: Boolean, default: false }
}, { timestamps: true });

leaveSchema.index({ employeeEmail: 1, startDate: -1 });
export const Leave = mongoose.model("Leave", leaveSchema);
