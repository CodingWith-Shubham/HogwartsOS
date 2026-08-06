import mongoose, { Schema } from "mongoose";

const leaveBalanceSchema = new Schema({
    employeeEmail: { type: String, required: true, lowercase: true },
    financialYear: { type: String, required: true },
    joiningDate: { type: Date, required: true },
    totalPL: { type: Number, required: true },
    usedPL: { type: Number, default: 0 },
    remainingPL: { type: Number, required: true },
    totalSL: { type: Number, default: 6 },
    usedSL: { type: Number, default: 0 },
    remainingSL: { type: Number, default: 6 }
}, { timestamps: true });

leaveBalanceSchema.index({ employeeEmail: 1, financialYear: 1 }, { unique: true });
export const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);
