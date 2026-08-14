import { Router } from "express";
import { getVapidPublicKey, subscribeToNotifications } from "../controllers/notification.controllers.js";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/vapidPublicKey", getVapidPublicKey);
router.post("/subscribe", verifyJWTOrN8N, subscribeToNotifications);

export default router;
