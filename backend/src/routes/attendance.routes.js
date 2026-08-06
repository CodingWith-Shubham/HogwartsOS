import { Router } from "express";
import { checkIn, checkOut, getMyAttendance, getTeamAttendance, requestFullDay, approveFullDayRequest, getAttendanceSummary } from "../controllers/attendance.controllers.js";
import { applyLeave, approveLopOverride, getLeaveBalance, getLopOverrides, getMyLeaves, getTeamLeaves, getWeeklyOffStatus, initializeLeaveBalance, leaveCertificateUpload, processWeeklyOff, requestLopOverride, reviewLeave, sendLeaveCertificate } from "../controllers/leave.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.post("/check-in", verifyJWT, checkIn);
router.post("/check-out", verifyJWT, checkOut);
router.get("/my-attendance", verifyJWT, getMyAttendance);
router.get("/team-attendance", verifyJWT, getTeamAttendance);
router.get("/summary", verifyJWT, getAttendanceSummary);
router.post("/request-full-day", verifyJWT, requestFullDay);
router.post("/approve-full-day", verifyJWT, approveFullDayRequest);
router.post("/apply-leave", verifyJWT, leaveCertificateUpload, applyLeave);
router.get("/my-leaves", verifyJWT, getMyLeaves);
router.get("/leave-balance", verifyJWT, getLeaveBalance);
router.get("/team-leaves", verifyJWT, getTeamLeaves);
router.post("/review-leave", verifyJWT, reviewLeave);
router.get("/leave-certificate/:leaveId", verifyJWT, sendLeaveCertificate);
router.post("/request-lop-override", verifyJWT, requestLopOverride);
router.post("/approve-lop-override", verifyJWT, approveLopOverride);
router.get("/lop-overrides", verifyJWT, getLopOverrides);
router.get("/weekly-off-status", verifyJWT, getWeeklyOffStatus);
router.post("/process-weekly-off", verifyJWT, processWeeklyOff);
router.post("/initialize-leave-balance", verifyJWT, initializeLeaveBalance);

export default router;
