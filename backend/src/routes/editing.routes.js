import { Router } from "express";
import { getEditingData, getEditorWorkload, updateTask, addRevision, assignTasks, createProject, getProjects, getProjectById, updateProject, createTask, getTaskById, updateTaskById, createRevision } from "../controllers/editing.controllers.js";
import { verifyJWT, verifyN8n, verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

// Existing Next.js routes
router.get("/", verifyJWT, getEditingData);
router.get("/workload", verifyJWT, getEditorWorkload);
router.put("/task/:taskId", verifyJWT, updateTask);
router.post("/revision", verifyJWT, addRevision);
router.post("/assign-tasks", verifyJWT, assignTasks);

// N8N Dedicated Endpoints
router.post("/projects", verifyN8n, createProject);
router.get("/projects", verifyJWTOrN8N, getProjects);
router.get("/projects/:edit_id", verifyJWTOrN8N, getProjectById);
router.put("/projects/:edit_id", verifyN8n, updateProject);

router.post("/tasks", verifyN8n, createTask);
router.get("/tasks/:task_id", verifyJWTOrN8N, getTaskById);
router.put("/tasks/:task_id", verifyN8n, updateTaskById);

router.post("/revisions", verifyN8n, createRevision);

export default router;
