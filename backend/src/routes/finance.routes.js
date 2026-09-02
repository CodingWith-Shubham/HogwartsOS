import { Router } from "express";
import { getFinanceDashboard } from "../controllers/finance.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

// Apply auth middleware to all routes in this file
router.use(verifyJWT);

router.route("/dashboard").get(getFinanceDashboard);

export default router;
