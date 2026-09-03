import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { 
    upsertSalesTarget, 
    getSalesTargetsByPeriod, 
    getSalesTargetHistory, 
    deleteSalesTarget 
} from "../controllers/salesTarget.controller.js";

const router = Router();

// Protect all routes
router.use(verifyJWT);

// Check if user is manager or admin for creating/deleting targets
const authorizeManager = (req, res, next) => {
    const role = req.user?.role?.toLowerCase();
    if (role !== "manager" && role !== "super_admin" && role !== "admin") {
        return res.status(403).json({ success: false, error: "Access denied. Managers only." });
    }
    next();
};

router.route("/")
    .post(authorizeManager, upsertSalesTarget)
    .get(getSalesTargetsByPeriod);

router.route("/history/:salesPersonId")
    .get(getSalesTargetHistory);

router.route("/:id")
    .delete(authorizeManager, deleteSalesTarget);

export default router;
