import { Router } from "express";
import { createUpsellLead, getUpsellMetrics } from "../controllers/upsell.controller.js";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

// Notice the paths assume this router is mounted at /api/v1
// The prompt asked for POST /api/v1/leads/upsell and GET /api/v1/analytics/upsell-metrics

router.post("/leads/upsell", verifyJWTOrN8N, createUpsellLead);
router.get("/analytics/upsell-metrics", verifyJWTOrN8N, getUpsellMetrics);

export default router;
