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
} from "../controllers/clientProfile.controller.js";
import { verifyJWT, verifyPublicClientToken } from "../middlewares/auth.middlewares.js";

const router = Router();

// ─── Public Routes (No standard JWT required) ──────────────────────────────
router.route("/public/me")
  .get(verifyPublicClientToken, getPublicProfile)
  .put(verifyPublicClientToken, updatePublicProfile);

// Protect all following routes with standard JWT verification
router.use(verifyJWT);

// CRM route to generate the link
router.route("/:id/generate-link")
  .post(generateOnboardingLink);

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
