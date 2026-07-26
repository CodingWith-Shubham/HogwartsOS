import { Router } from "express";
import { getPayments, createPayment, verifyPayment } from "../controllers/payment.controllers.js";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWTOrN8N, getPayments);
router.post("/", verifyJWTOrN8N, createPayment);
router.put("/:paymentId/verify", verifyJWTOrN8N, verifyPayment);

export default router;
