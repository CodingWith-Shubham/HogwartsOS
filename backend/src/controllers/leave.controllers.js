import path from "path";
import fs from "fs";
import multer from "multer";
import { Attendance } from "../models/attendance.models.js";
import { Leave } from "../models/leave.models.js";
import { LeaveBalance } from "../models/leaveBalance.models.js";
import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

// Kept outside Express's public directory; certificates are served only through
// the authenticated leave-certificate endpoint below.
const uploadsDir = path.resolve("uploads", "leave-certificates");
fs.mkdirSync(uploadsDir, { recursive: true });
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const extensionFor = (file) => path.extname(file.originalname).toLowerCase() || (file.mimetype === "application/pdf" ? ".pdf" : ".jpg");
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extensionFor(file)}`)
});
export const leaveCertificateUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(allowedMimeTypes.has(file.mimetype) ? null : new ApiError(400, "Certificate must be a PDF, JPG, or PNG"), allowedMimeTypes.has(file.mimetype))
}).single("certificate");

const dateString = (value = new Date()) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const parseDate = (value) => new Date(`${dateString(value)}T00:00:00.000Z`);
const financialYear = (value = new Date()) => {
    const d = parseDate(value); const year = d.getUTCFullYear(); const start = d.getUTCMonth() >= 3 ? year : year - 1;
    return `${start}-${String(start + 1).slice(-2)}`;
};
const isManager = (role) => ["manager", "admin", "super_admin"].includes(role);
const currentFYStart = (value = new Date()) => {
    const d = parseDate(value); return new Date(Date.UTC(d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1, 3, 1));
};
const calculateTotalPL = (joiningDate, now = new Date()) => {
    const join = parseDate(joiningDate); const fyStart = currentFYStart(now); const effective = join > fyStart ? join : fyStart;
    if (effective > new Date(Date.UTC(fyStart.getUTCFullYear() + 1, 2, 31))) return 0;
    return 12 - (effective.getUTCMonth() - 3);
};
const isLockInComplete = (joiningDate) => {
    const unlock = parseDate(joiningDate); unlock.setUTCMonth(unlock.getUTCMonth() + 3); return new Date() >= unlock;
};
const getOrCreateBalance = async (user) => {
    const fy = financialYear();
    let balance = await LeaveBalance.findOne({ employeeEmail: user.email.toLowerCase(), financialYear: fy });
    if (!balance) {
        const joiningDate = user.joiningDate || user.createdAt || new Date();
        const totalPL = calculateTotalPL(joiningDate);
        balance = await LeaveBalance.create({ employeeEmail: user.email.toLowerCase(), financialYear: fy, joiningDate, totalPL, remainingPL: totalPL, totalSL: 6, remainingSL: 6 });
    }
    return balance;
};
const datesInRange = (start, end) => {
    const dates = []; const cursor = parseDate(start); const last = parseDate(end);
    while (cursor <= last) { dates.push(dateString(cursor)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    return dates;
};
const cleanup = (file) => { if (file?.path) fs.unlink(file.path, () => {}); };

// Classify completed, unmarked days for one employee. The first missed day in a
// Mon-Sun week consumes the weekly off; every later missed day becomes LOP.
// Today is intentionally excluded because an employee may still check in.
export const classifyMissedDaysForUser = async (user, throughDate = new Date()) => {
    // Super admins are exempt from employee attendance, Weekly Off, and LOP policy.
    if (user.role === "super_admin") return 0;
    const last = parseDate(throughDate);
    const today = parseDate(new Date());
    if (last >= today) last.setUTCDate(last.getUTCDate() - 1);
    const monday = new Date(last);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    if (last < monday) return 0;
    const email = user.email.toLowerCase();
    let created = 0;
    for (const date of datesInRange(dateString(monday), dateString(last))) {
        const existing = await Attendance.findOne({ employeeEmail: email, date });
        if (existing) continue;
        const weeklyOffUsed = await Attendance.exists({ employeeEmail: email, date: { $gte: dateString(monday), $lte: date }, weeklyOffUsed: true });
        await Attendance.create({
            employeeId: user.empId || user._id.toString(), employeeName: user.name,
            employeeEmail: email, date, status: weeklyOffUsed ? "LOP" : "Weekly Off",
            weeklyOffUsed: !weeklyOffUsed, lopApplied: Boolean(weeklyOffUsed)
        });
        created++;
    }
    return created;
};

export const applyLeave = asyncHandler(async (req, res) => {
    if (req.user.role === "super_admin") throw new ApiError(403, "Super admins do not use the employee leave workflow");
    const { leaveType, startDate, endDate, reason } = req.body;
    const start = dateString(startDate); const end = dateString(endDate); const today = dateString();
    if (!["Paid", "Sick"].includes(leaveType) || !reason?.trim() || !startDate || !endDate || start > end) { cleanup(req.file); throw new ApiError(400, "Provide a valid leave type, date range, and reason"); }
    if (leaveType === "Paid" && start < today) { cleanup(req.file); throw new ApiError(400, "Paid Leave must be applied on or before the leave date"); }
    if (leaveType === "Sick" && !req.file) { throw new ApiError(400, "A medical certificate is required for Sick Leave"); }
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) { cleanup(req.file); throw new ApiError(401, "Unauthorized"); }
    if (leaveType === "Paid" && !isLockInComplete(currentUser?.joiningDate || currentUser?.createdAt)) {
        cleanup(req.file);
        throw new ApiError(400, "Paid Leave can be applied for after completing three months");
    }
    const dates = datesInRange(start, end);
    const duplicate = await Leave.exists({ employeeEmail: req.user.email.toLowerCase(), status: { $in: ["Pending", "Approved"] }, startDate: { $lte: end }, endDate: { $gte: start } });
    if (duplicate) { cleanup(req.file); throw new ApiError(409, "An overlapping pending or approved leave request already exists"); }
    const weeklyOffDates = await Attendance.find({ employeeEmail: req.user.email.toLowerCase(), date: { $in: dates }, status: "Weekly Off" }).distinct("date");
    const totalDays = dates.length - weeklyOffDates.length;
    if (totalDays <= 0) { cleanup(req.file); throw new ApiError(400, "The selected dates contain only weekly offs"); }
    const balance = await getOrCreateBalance(currentUser);
    const available = leaveType === "Paid" ? balance.remainingPL : balance.remainingSL;
    if (available < totalDays) { cleanup(req.file); throw new ApiError(400, `Insufficient ${leaveType} Leave balance`); }
    const leave = await Leave.create({ employeeEmail: req.user.email.toLowerCase(), employeeName: req.user.name, leaveType, startDate: start, endDate: end, totalDays, reason: reason.trim(), isRetroactive: start < today, certificateUrl: req.file ? `/uploads/leave-certificates/${req.file.filename}` : undefined, certificateFileName: req.file?.originalname, certificateMimeType: req.file?.mimetype });
    res.status(201).json(new ApiResponse(201, { leave }, "Leave request submitted. Balance is deducted only after approval."));
});

export const getMyLeaves = asyncHandler(async (req, res) => {
    const leaves = await Leave.find({ employeeEmail: req.user.email.toLowerCase() }).sort({ createdAt: -1 });
    res.json(new ApiResponse(200, { leaves }, "Leave history retrieved"));
});
export const getLeaveBalance = asyncHandler(async (req, res) => res.json(new ApiResponse(200, { balance: await getOrCreateBalance(req.user) }, "Leave balance retrieved")));
export const getTeamLeaves = asyncHandler(async (req, res) => {
    if (!isManager(req.user.role)) throw new ApiError(403, "Manager access required");
    const query = req.query.status ? { status: req.query.status } : {};
    res.json(new ApiResponse(200, { leaves: await Leave.find(query).sort({ createdAt: -1 }).limit(200) }, "Team leaves retrieved"));
});

export const reviewLeave = asyncHandler(async (req, res) => {
    if (!isManager(req.user.role)) throw new ApiError(403, "Manager access required");
    const { leaveId, action } = req.body;
    if (!["Approved", "Rejected"].includes(action)) throw new ApiError(400, "Action must be Approved or Rejected");
    const leave = await Leave.findById(leaveId);
    if (!leave) throw new ApiError(404, "Leave request not found");
    if (leave.status !== "Pending") throw new ApiError(400, "Leave request has already been reviewed");
    if (action === "Approved") {
        const user = await User.findOne({ email: leave.employeeEmail });
        if (!user) throw new ApiError(404, "Employee not found");
        if (leave.leaveType === "Paid" && !isLockInComplete(user.joiningDate || user.createdAt)) {
            throw new ApiError(400, "Employee is not eligible for Paid Leave yet");
        }
        const balance = await getOrCreateBalance(user); const field = leave.leaveType === "Paid" ? "remainingPL" : "remainingSL";
        if (balance[field] < leave.totalDays) throw new ApiError(400, `Insufficient ${leave.leaveType} Leave balance`);
        balance[field] -= leave.totalDays; leave.leaveType === "Paid" ? balance.usedPL += leave.totalDays : balance.usedSL += leave.totalDays;
        await balance.save();
        for (const date of datesInRange(leave.startDate, leave.endDate)) {
            const current = await Attendance.findOne({ employeeEmail: leave.employeeEmail, date });
            if (current?.status === "Weekly Off") continue;
            if (current?.checkIn && ["Present", "Late"].includes(current.status)) throw new ApiError(409, `Cannot approve leave for attended date ${date}`);
            await Attendance.findOneAndUpdate({ employeeEmail: leave.employeeEmail, date }, { $set: { employeeId: user.empId || user._id.toString(), employeeName: user.name, employeeEmail: leave.employeeEmail, date, status: "Leave", lopApplied: false } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        }
    }
    leave.status = action; leave.reviewedBy = req.user.email; leave.reviewedOn = new Date(); await leave.save();
    res.json(new ApiResponse(200, { leave }, `Leave ${action.toLowerCase()}`));
});

export const requestLopOverride = asyncHandler(async (req, res) => {
    if (req.user.role === "super_admin") throw new ApiError(403, "Super admins do not use the LOP override workflow");
    const attendance = await Attendance.findOne({ _id: req.body.attendanceId, employeeEmail: req.user.email.toLowerCase() });
    if (!attendance) throw new ApiError(404, "Attendance record not found");
    if (!["LOP", "Absent", "Half Day", "Half-day"].includes(attendance.status) && !attendance.lopApplied) throw new ApiError(400, "This record has no LOP to override");
    if (!req.body.note?.trim()) throw new ApiError(400, "Please provide an explanation");
    attendance.lopOverrideRequest = { requested: true, note: req.body.note.trim(), status: "Pending", requestedOn: new Date() }; await attendance.save();
    res.json(new ApiResponse(200, { attendance }, "LOP override request submitted"));
});
export const approveLopOverride = asyncHandler(async (req, res) => {
    if (req.user.role !== "super_admin") throw new ApiError(403, "Only super admins can review LOP overrides");
    const { attendanceId, action } = req.body; if (!["Approved", "Rejected"].includes(action)) throw new ApiError(400, "Invalid action");
    const attendance = await Attendance.findById(attendanceId); if (!attendance?.lopOverrideRequest?.requested || attendance.lopOverrideRequest.status !== "Pending") throw new ApiError(404, "Pending LOP override request not found");
    attendance.lopOverrideRequest.status = action; attendance.lopOverrideRequest.reviewedBy = req.user.email; attendance.lopOverrideRequest.reviewedOn = new Date();
    if (action === "Approved") { attendance.status = "Present"; attendance.lopApplied = false; attendance.halfDayType = null; }
    await attendance.save(); res.json(new ApiResponse(200, { attendance }, `LOP override ${action.toLowerCase()}`));
});
export const getLopOverrides = asyncHandler(async (req, res) => {
    if (req.user.role !== "super_admin") throw new ApiError(403, "Only super admins can view LOP overrides");
    res.json(new ApiResponse(200, { records: await Attendance.find({ "lopOverrideRequest.status": "Pending" }).sort({ date: -1 }) }, "LOP override requests retrieved"));
});

export const getWeeklyOffStatus = asyncHandler(async (req, res) => {
    const now = new Date(); const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
    const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);
    const weeklyOff = await Attendance.findOne({ employeeEmail: req.user.email.toLowerCase(), date: { $gte: dateString(monday), $lte: dateString(sunday) }, weeklyOffUsed: true });
    res.json(new ApiResponse(200, { used: Boolean(weeklyOff), date: weeklyOff?.date || null }, "Weekly off status retrieved"));
});
export const processWeeklyOff = asyncHandler(async (req, res) => {
    if (!["admin", "super_admin"].includes(req.user.role)) throw new ApiError(403, "System access required");
    const target = dateString(req.body?.date || new Date()); const targetDate = parseDate(target); const monday = new Date(targetDate); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7)); const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);
    const users = await User.find({}, "_id empId name email"); let processed = 0;
    for (const user of users) {
        processed += await classifyMissedDaysForUser(user, target);
    }
    res.json(new ApiResponse(200, { processed, date: target }, "Weekly off processing complete"));
});
export const initializeLeaveBalance = asyncHandler(async (req, res) => {
    if (!["admin", "super_admin"].includes(req.user.role)) throw new ApiError(403, "Admin access required");
    const user = await User.findOne({ email: req.body.employeeEmail?.toLowerCase() }); if (!user) throw new ApiError(404, "Employee not found");
    if (req.body.joiningDate) { user.joiningDate = parseDate(req.body.joiningDate); await user.save(); }
    const joiningDate = user.joiningDate || user.createdAt; const fy = financialYear(); const totalPL = calculateTotalPL(joiningDate);
    const balance = await LeaveBalance.findOneAndUpdate({ employeeEmail: user.email, financialYear: fy }, { $setOnInsert: { employeeEmail: user.email, financialYear: fy, joiningDate, totalPL, remainingPL: totalPL, totalSL: 6, remainingSL: 6 } }, { upsert: true, new: true });
    res.json(new ApiResponse(200, { balance }, "Leave balance initialized"));
});

export const sendLeaveCertificate = asyncHandler(async (req, res) => {
    const leave = await Leave.findById(req.params.leaveId); if (!leave?.certificateUrl) throw new ApiError(404, "Certificate not found");
    if (leave.employeeEmail !== req.user.email.toLowerCase() && !isManager(req.user.role)) throw new ApiError(403, "Not allowed to view this certificate");
    res.sendFile(path.resolve(uploadsDir, path.basename(leave.certificateUrl)));
});
