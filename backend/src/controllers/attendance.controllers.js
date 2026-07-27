import { Attendance } from "../models/attendance.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const getTodayString = () => new Date().toISOString().split('T')[0];

const checkIn = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new ApiError(401, "Unauthorized");
    }

    const date = req.body.date || getTodayString();
    const existing = await Attendance.findOne({
        employeeEmail: user.email.toLowerCase(),
        date
    });

    if (existing && existing.checkIn) {
        return res.status(200).json(new ApiResponse(200, { attendance: existing }, "Already checked in today"));
    }

    const now = new Date();
    // Mark Late if checking in after 10:30 AM
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const isLate = hours > 10 || (hours === 10 && minutes > 30);

    const checkInLocation = req.body.checkInLocation || { lat: null, lng: null };

    const attendance = await Attendance.findOneAndUpdate(
        { employeeEmail: user.email.toLowerCase(), date },
        {
            $set: {
                employeeId: user.empId || user._id.toString(),
                employeeName: user.name,
                employeeEmail: user.email.toLowerCase(),
                date,
                checkIn: now,
                status: isLate ? "Late" : "Present",
                workLocation: req.body.workLocation || "Office",
                notes: req.body.notes || "",
                checkInLocation: {
                    lat: checkInLocation.lat ?? null,
                    lng: checkInLocation.lng ?? null
                }
            }
        },
        { upsert: true, new: true }
    );

    return res.status(200).json(new ApiResponse(200, { attendance }, "Checked in successfully"));
});

const checkOut = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new ApiError(401, "Unauthorized");
    }

    const date = req.body.date || getTodayString();
    const attendance = await Attendance.findOne({
        employeeEmail: user.email.toLowerCase(),
        date
    });

    if (!attendance) {
        throw new ApiError(404, "Check-in record for today not found. Please check in first.");
    }

    attendance.checkOut = new Date();
    if (req.body.notes) {
        attendance.notes = `${attendance.notes} | ${req.body.notes}`.trim();
    }
    const checkOutLocation = req.body.checkOutLocation || { lat: null, lng: null };
    attendance.checkOutLocation = {
        lat: checkOutLocation.lat ?? null,
        lng: checkOutLocation.lng ?? null
    };
    await attendance.save();

    return res.status(200).json(new ApiResponse(200, { attendance }, "Checked out successfully"));
});

const getMyAttendance = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new ApiError(401, "Unauthorized");
    }

    const logs = await Attendance.find({
        employeeEmail: user.email.toLowerCase()
    }).sort({ date: -1 });

    const todayLog = logs.find(l => l.date === getTodayString()) || null;

    return res.status(200).json(new ApiResponse(200, {
        today: todayLog,
        history: logs
    }, "Attendance record retrieved successfully"));
});

const getTeamAttendance = asyncHandler(async (req, res) => {
    const date = req.query.date || getTodayString();
    const logs = await Attendance.find({ date }).sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, { date, logs }, "Team attendance logs retrieved successfully"));
});

export { checkIn, checkOut, getMyAttendance, getTeamAttendance };
