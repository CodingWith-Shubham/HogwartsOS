import { Router } from "express";
import { checkIn, checkOut, getMyAttendance, getTeamAttendance } from "../controllers/attendance.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.post("/check-in", verifyJWT, checkIn);
router.post("/check-out", verifyJWT, checkOut);
router.get("/my-attendance", verifyJWT, getMyAttendance);
router.get("/team-attendance", verifyJWT, getTeamAttendance);

export default router;
