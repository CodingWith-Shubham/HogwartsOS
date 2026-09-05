import { Router } from "express";
import { getShoots, getShootById, createShoot, updateShoot, deleteShoot, rescheduleShoot } from "../controllers/shoot.controllers.js";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/:shootId", verifyJWTOrN8N, getShootById);
router.get("/", verifyJWTOrN8N, getShoots);
router.post("/", verifyJWTOrN8N, createShoot);
router.put("/:shootId", verifyJWTOrN8N, updateShoot);
// Release a shoot for rescheduling (soft-cancel with "Rescheduled" note). The
// frontend then re-fires the unchanged n8n schedule-shoot webhook so the
// updated shoot + calendar invite are created by the existing workflow.
router.post("/:shootId/reschedule", verifyJWTOrN8N, rescheduleShoot);
// Soft-cancel a shoot (marks bookingStatus → 'cancelled'). Used for both
// tentative holds and confirmed shoots that need to be cleared by staff.
router.delete("/:shootId", verifyJWTOrN8N, deleteShoot);

export default router;
