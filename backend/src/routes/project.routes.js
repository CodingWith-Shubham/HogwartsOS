import { Router } from "express";
import * as projectController from "../controllers/project.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import {
  createProjectValidator,
  updateProjectValidator,
  addMemberValidator,
  updateRoleValidator,
} from "../validators/project.validators.js";

const router = Router();

router.use(verifyJWT);

router.route("/").get(projectController.getProjects).post(
  projectController.createProject
);

router
  .route("/:projectId")
  .get(projectController.getProjectDetails)
  .put(
    projectController.updateProject
  )
  .delete(projectController.deleteProject);

router
  .route("/:projectId/members")
  .get(projectController.getProjectMembers)
  .post(
    projectController.addProjectMember
  );

router
  .route("/:projectId/members/:userId")
  .put(
    projectController.updateMemberRole
  )
  .delete(projectController.removeProjectMember);

export default router;
