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
        enum: ["Present", "Late", "Half-day", "Half Day", "Absent", "Weekly Off", "Leave", "LOP"],
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
    },
    fullDayRequest: {
        type: Boolean,
        default: false
    },
    fullDayRequestStatus: {
        type: String,
        enum: ["None", "Pending", "Approved", "Rejected"],
        default: "None"
    },
    weeklyOffUsed: { type: Boolean, default: false },
    lopApplied: { type: Boolean, default: false },
    halfDayType: { type: String, enum: ["first_half", "second_half", null], default: null },
    lopOverrideRequest: {
        requested: { type: Boolean, default: false },
        note: { type: String, default: "" },
        status: { type: String, enum: ["Pending", "Approved", "Rejected", null], default: null },
        requestedOn: Date,
        reviewedBy: String,
        reviewedOn: Date
    },
    checkInLocation: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    },
    checkOutLocation: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    }
}, { timestamps: true });

// Compound index so each employee has one attendance record per date
attendanceSchema.index({ employeeEmail: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", attendanceSchema);
