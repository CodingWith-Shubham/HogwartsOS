import { Router } from "express";
import { getMarketingTasks, assignMarketingTask, updateMarketingTaskStatus } from "../controllers/marketing.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.use(verifyJWT); // Secure all routes

router.route("/").get(getMarketingTasks);
router.route("/:taskId/assign").patch(assignMarketingTask);
router.route("/:taskId/status").patch(updateMarketingTaskStatus);

export default router;
