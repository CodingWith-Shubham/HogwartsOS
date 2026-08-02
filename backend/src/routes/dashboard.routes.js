import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { getCorrectionsVsRevisions, getRevenueMetrics } from "../controllers/dashboard.controller.js";

const router = Router();

router.use(verifyJWT);

// GET /api/v1/dashboard/corrections-vs-revisions
router.route("/corrections-vs-revisions").get(getCorrectionsVsRevisions);
router.route("/revenue").get(getRevenueMetrics);

export default router;
