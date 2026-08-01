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

    // 8.5 hours minimum check
    // Calculate difference in hours
    const diffMs = attendance.checkOut.getTime() - attendance.checkIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);

    if (user.role !== "manager") {
        if (hours >= 8.5) {
            // Overwrite Late to Present? My proposal was to keep it Late if they were late, but the user didn't specify. 
            // If they are Half-day they become Present. If they are Late, they stay Late (but full shift). If they are Present, they stay Present.
            if (attendance.status === "Half-day" || attendance.status === "Absent") {
                attendance.status = "Present";
            }
        } else {
            // Less than 8.5 hours
            attendance.status = "Half-day";
        }
    } else {
        // Manager is always Present (or keeps their Late status)
        if (attendance.status === "Half-day" || attendance.status === "Absent") {
            attendance.status = "Present";
        }
    }

    await attendance.save();

    return res.status(200).json(new ApiResponse(200, { attendance }, "Checked out successfully"));
});

const requestFullDay = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) throw new ApiError(401, "Unauthorized");

    const date = req.body.date || getTodayString();
    const attendance = await Attendance.findOne({
        employeeEmail: user.email.toLowerCase(),
        date
    });

    if (!attendance) throw new ApiError(404, "Attendance record not found");
    if (attendance.status !== "Half-day") throw new ApiError(400, "You can only request a full day shift on a half-day record");

    attendance.fullDayRequest = true;
    attendance.fullDayRequestStatus = "Pending";
    await attendance.save();

    return res.status(200).json(new ApiResponse(200, { attendance }, "Full day request submitted successfully"));
});

const approveFullDayRequest = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user || user.role !== "manager") {
        throw new ApiError(403, "Only Super Admins can approve requests");
    }

    const { attendanceId, action } = req.body;
    if (!["approve", "reject"].includes(action)) {
        throw new ApiError(400, "Invalid action");
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) throw new ApiError(404, "Attendance record not found");
    if (!attendance.fullDayRequest || attendance.fullDayRequestStatus !== "Pending") {
        throw new ApiError(400, "No pending request for this record");
    }

    if (action === "approve") {
        attendance.fullDayRequestStatus = "Approved";
        attendance.status = "Present";
    } else {
        attendance.fullDayRequestStatus = "Rejected";
        // Status remains Half-day
    }

    await attendance.save();
    return res.status(200).json(new ApiResponse(200, { attendance }, `Request ${action}d successfully`));
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

export { checkIn, checkOut, getMyAttendance, getTeamAttendance, requestFullDay, approveFullDayRequest };
