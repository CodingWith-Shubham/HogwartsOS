import { Router } from "express";
import { getRealtimeData } from "../controllers/realtime.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWT, getRealtimeData);

export default router;
