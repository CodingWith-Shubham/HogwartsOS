import { Router } from "express";
import { getShoots, getShootById, createShoot, updateShoot, deleteShoot } from "../controllers/shoot.controllers.js";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/:shootId", verifyJWTOrN8N, getShootById);
router.get("/", verifyJWTOrN8N, getShoots);
router.post("/", verifyJWTOrN8N, createShoot);
router.put("/:shootId", verifyJWTOrN8N, updateShoot);
// Soft-cancel a shoot (marks bookingStatus → 'cancelled'). Used for both
// tentative holds and confirmed shoots that need to be cleared by staff.
router.delete("/:shootId", verifyJWTOrN8N, deleteShoot);

export default router;
