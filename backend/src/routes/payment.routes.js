import { Router } from "express";
import { getPayments, createPayment, verifyPayment } from "../controllers/payment.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWT, getPayments);
router.post("/", verifyJWT, createPayment);
router.put("/:paymentId/verify", verifyJWT, verifyPayment);

export default router;
