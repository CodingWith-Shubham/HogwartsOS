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
} from "../controllers/clientProfile.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

// Protect all routes with JWT verification
router.use(verifyJWT);

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
