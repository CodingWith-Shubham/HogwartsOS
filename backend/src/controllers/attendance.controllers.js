import { Attendance } from "../models/attendance.models.js";
import { LeaveBalance } from "../models/leaveBalance.models.js";
import { classifyMissedDaysForUser } from "./leave.controllers.js";
import { User } from "../models/user.models.js";
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
    // Mark Late if checking in after 10:15 AM
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const isLate = hours > 10 || (hours === 10 && minutes > 15);

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

    if (!["manager", "super_admin"].includes(user.role)) {
        if (hours >= 8.5) {
            // Full shift: if they were marked Half-day/Absent on check-in, upgrade to Present.
            // Late stays Late (they completed the full shift).
            if (attendance.status === "Half-day" || attendance.status === "Absent") {
                attendance.status = "Present";
            }
        } else if (hours >= 4) {
            // 4 to 8.5 hours -> Half-day
            attendance.status = "Half-day";
            attendance.lopApplied = false;
            attendance.halfDayType = "second_half";
        } else {
            // Less than 4 hours -> LOP
            attendance.status = "LOP";
            attendance.lopApplied = true;
        }
    } else {
        // Managers and super admins are always Present (or keep Late status).
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
    if (!user || !["manager", "admin", "super_admin"].includes(user.role)) {
        throw new ApiError(403, "Only managers, admins, or super admins can approve full-day requests");
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
        attendance.lopApplied = false;
        attendance.halfDayType = null;
    } else {
        attendance.fullDayRequestStatus = "Rejected";
        // Status remains Half-day
    }

    await attendance.save();
    return res.status(200).json(new ApiResponse(200, { attendance }, `Request ${action}d successfully`));
});

// Returns all attendance records with a pending full-day request.
// Accessible by manager, admin, and super_admin.
const getFullDayRequests = asyncHandler(async (req, res) => {
    if (!req.user || !["manager", "admin", "super_admin"].includes(req.user.role)) {
        throw new ApiError(403, "Manager access required");
    }
    const records = await Attendance.find({
        fullDayRequest: true,
        fullDayRequestStatus: "Pending"
    }).sort({ date: -1 });
    return res.status(200).json(new ApiResponse(200, { records }, "Full day requests retrieved successfully"));
});

const getMyAttendance = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new ApiError(401, "Unauthorized");
    }

    const employee = await User.findById(user._id);
    if (employee) await classifyMissedDaysForUser(employee);
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
    if (!["manager", "admin", "super_admin"].includes(req.user?.role)) throw new ApiError(403, "Manager access required");
    const date = req.query.date || getTodayString();
    // Ensure completed days show their Weekly Off/LOP classification even when
    // nobody has manually run the scheduler yet.
    if (date < getTodayString()) {
        const employees = await User.find({}, "_id empId name email");
        await Promise.all(employees.map(employee => classifyMissedDaysForUser(employee, date)));
    }
    const records = await Attendance.find({ date }).sort({ createdAt: -1 });
    const fyStart = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const balances = await LeaveBalance.find({ employeeEmail: { $in: records.map(record => record.employeeEmail) }, financialYear: `${fyStart}-${String(fyStart + 1).slice(-2)}` });
    const balanceByEmail = new Map(balances.map(balance => [balance.employeeEmail, { remainingPL: balance.remainingPL, totalPL: balance.totalPL, remainingSL: balance.remainingSL, totalSL: balance.totalSL }]));
    const logs = records.map(record => ({ ...record.toObject(), leaveBalance: balanceByEmail.get(record.employeeEmail) || null }));

    return res.status(200).json(new ApiResponse(200, { date, logs }, "Team attendance logs retrieved successfully"));
});

const getAttendanceSummary = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user || user.role !== "super_admin") {
        throw new ApiError(403, "Only Super Admins can access attendance summary");
    }

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    if ((startDate && !endDate) || (!startDate && endDate) || (startDate && endDate && startDate > endDate)) {
        throw new ApiError(400, "Provide a valid startDate and endDate range");
    }
    const dateQuery = startDate ? { date: { $gte: startDate, $lte: endDate } } : {};
    const logs = await Attendance.find(dateQuery).sort({ date: 1 });

    // Aggregate by employee and then by month
    // summaryMap: { [email]: { name, email, months: { '2026-08': { present: 0, late: 0, halfDay: 0, absent: 0 } } } }
    const summaryMap = {};

    for (const log of logs) {
        const email = log.employeeEmail.toLowerCase();
        if (!summaryMap[email]) {
            summaryMap[email] = {
                name: log.employeeName,
                email: email,
                months: {}
            };
        }

        const dateObj = new Date(log.date);
        const yearMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

        if (!summaryMap[email].months[yearMonth]) {
            summaryMap[email].months[yearMonth] = {
                Present: 0,
                Late: 0,
                "Half-day": 0,
                Absent: 0
            };
        }

        const status = log.status || "Absent";
        if (summaryMap[email].months[yearMonth][status] !== undefined) {
            summaryMap[email].months[yearMonth][status]++;
        } else {
            summaryMap[email].months[yearMonth][status] = 1;
        }
    }

    const getWorkingDaysInMonth = (year, month) => {
        const monthStart = new Date(Date.UTC(year, month, 1));
        const monthEnd = new Date(Date.UTC(year, month + 1, 0));
        const rangeStart = startDate ? new Date(`${startDate}T00:00:00.000Z`) : monthStart;
        const rangeEnd = endDate ? new Date(`${endDate}T00:00:00.000Z`) : monthEnd;
        let date = new Date(Math.max(monthStart.getTime(), rangeStart.getTime()));
        const lastDate = new Date(Math.min(monthEnd.getTime(), rangeEnd.getTime()));
        let workingDays = 0;
        while (date <= lastDate) {
            if (date.getUTCDay() !== 0) workingDays++; // excluding Sunday
            date.setUTCDate(date.getUTCDate() + 1);
        }
        return workingDays;
    };

    const summaries = Object.values(summaryMap).map(employee => {
        for (const [yearMonth, stats] of Object.entries(employee.months)) {
            const [yearStr, monthStr] = yearMonth.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10) - 1;

            const workingDays = getWorkingDaysInMonth(year, month);
            stats.totalWorkingDays = workingDays;

            const presentDays = (stats.Present || 0) + (stats.Late || 0) + ((stats["Half-day"] || 0) * 0.5);
            let percentage = 0;
            if (workingDays > 0) {
                percentage = Math.round((presentDays / workingDays) * 100);
            }
            stats.attendancePercentage = percentage;
        }
        return employee;
    });

    return res.status(200).json(new ApiResponse(200, { summaries, startDate: startDate || null, endDate: endDate || null }, "Attendance summaries retrieved successfully"));
});

export { checkIn, checkOut, getMyAttendance, getTeamAttendance, requestFullDay, approveFullDayRequest, getFullDayRequests, getAttendanceSummary };
