import { Router } from "express";
import {
  createClientProfile,
  getAllClientProfiles,
  getSingleClientProfile,
  updateClientProfile,
  deleteClientProfile,
  checkDuplicateProfile,
  addPreviousProject,
  removePreviousProject,
  searchProjects,
  generateOnboardingLink,
  sendOnboardingLinkViaWebhook,
  getPublicProfile,
  updatePublicProfile,
  uploadAttachment,
  getAttachment,
} from "../controllers/clientProfile.controller.js";
import { verifyJWT, verifyPublicClientToken } from "../middlewares/auth.middlewares.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.resolve("uploads", "client-attachments");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`)
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

const router = Router();

// ─── Public Routes (No standard JWT required) ──────────────────────────────
router.route("/public/me")
  .get(verifyPublicClientToken, getPublicProfile)
  .put(verifyPublicClientToken, updatePublicProfile);

router.route("/public/upload-attachment")
  .post(verifyPublicClientToken, upload.single("attachment"), uploadAttachment);

router.route("/attachments/:filename")
  .get(getAttachment);

// Protect all following routes with standard JWT verification
router.use(verifyJWT);

// CRM route to generate the link
router.route("/:id/generate-link")
  .post(generateOnboardingLink);

router.route("/upload-attachment")
  .post(upload.single("attachment"), uploadAttachment);

// CRM route to send the onboarding link via n8n webhook
router.route("/:id/send-onboarding")
  .post(sendOnboardingLinkViaWebhook);


router.route("/")
  .get(getAllClientProfiles)
  .post(createClientProfile);

router.route("/check-duplicate")
  .post(checkDuplicateProfile);

router.route("/:id")
  .get(getSingleClientProfile)
  .patch(updateClientProfile)
  .delete(deleteClientProfile);

// Previous Projects management
router.route("/:id/previous-projects")
  .post(addPreviousProject);

router.route("/:id/previous-projects/:projectId")
  .delete(removePreviousProject);

router.route("/:id/search-projects")
  .get(searchProjects);

export default router;
