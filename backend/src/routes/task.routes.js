import { Router } from "express";
import * as taskController from "../controllers/task.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router({ mergeParams: true });

router.use(verifyJWT);

router
  .route("/:projectId")
  .get(taskController.getTasks)
  .post(taskController.createTask);

router
  .route("/:projectId/t/:taskId")
  .get(taskController.getTaskDetails)
  .put(taskController.updateTask)
  .delete(taskController.deleteTask);

router.route("/:projectId/t/:taskId/subtasks").post(
  taskController.createSubtask
);

router
  .route("/:projectId/st/:subTaskId")
  .put(taskController.updateSubtask)
  .delete(taskController.deleteSubtask);

export default router;
