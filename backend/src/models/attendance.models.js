import mongoose, { Schema } from "mongoose";

const attendanceSchema = new Schema({
    employeeId: {
        type: String,
        required: true,
        index: true
    },
    employeeName: {
        type: String,
        required: true
    },
    employeeEmail: {
        type: String,
        required: true,
        index: true
    },
    date: {
        type: String, // YYYY-MM-DD
        required: true,
        index: true
    },
    checkIn: {
        type: Date
    },
    checkOut: {
        type: Date
    },
    status: {
        type: String,
        enum: ["Present", "Late", "Half-day", "Absent"],
        default: "Present"
    },
    workLocation: {
        type: String,
        enum: ["Office", "Remote", "On-site Shoot"],
        default: "Office"
    },
    notes: {
        type: String,
        default: ""
    }
}, { timestamps: true });

// Compound index so each employee has one attendance record per date
attendanceSchema.index({ employeeEmail: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", attendanceSchema);
