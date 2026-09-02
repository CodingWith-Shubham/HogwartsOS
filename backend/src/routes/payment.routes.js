import { Router } from "express";
import { getPayments, createPayment, verifyPayment, uploadPaymentScreenshot, getPaymentScreenshot } from "../controllers/payment.controllers.js";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.resolve("uploads", "payment-screenshots");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`)
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = Router();

router.get("/", verifyJWTOrN8N, getPayments);
router.post("/", verifyJWTOrN8N, createPayment);
router.post("/upload-screenshot", verifyJWTOrN8N, upload.single("screenshot"), uploadPaymentScreenshot);
router.get("/screenshots/:filename", getPaymentScreenshot);
router.put("/:paymentId/verify", verifyJWTOrN8N, verifyPayment);

export default router;
