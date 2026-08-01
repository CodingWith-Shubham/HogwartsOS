import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { getCorrectionsVsRevisions } from "../controllers/dashboard.controller.js";

const router = Router();

router.use(verifyJWT);

// GET /api/v1/dashboard/corrections-vs-revisions
router.route("/corrections-vs-revisions").get(getCorrectionsVsRevisions);

export default router;
