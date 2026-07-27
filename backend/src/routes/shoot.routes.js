import { Router } from "express";
import { getShoots, getShootById, createShoot, updateShoot } from "../controllers/shoot.controllers.js";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/:shootId", verifyJWTOrN8N, getShootById);
router.get("/", verifyJWTOrN8N, getShoots);
router.post("/", verifyJWTOrN8N, createShoot);
router.put("/:shootId", verifyJWTOrN8N, updateShoot);

export default router;
