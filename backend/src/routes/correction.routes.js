import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    createCorrection,
    resolveCorrection,
    getCorrectionsByTask,
    getCorrectionsByProject,
    getCorrectionSummary
} from "../controllers/correction.controller.js";

const router = Router();

// Apply verifyJWT middleware to all routes in this file
router.use(verifyJWT);

// Create a new correction
router.route("/").post(createCorrection);

// Get summary for manager
router.route("/summary").get(getCorrectionSummary);

// Resolve a correction
router.route("/:correctionId/resolve").patch(resolveCorrection);

// Get corrections by task
router.route("/task/:editingTaskId").get(getCorrectionsByTask);

// Get corrections by project
router.route("/project/:projectId").get(getCorrectionsByProject);

export default router;
