import { Router } from "express";
import { getEditingData, getEditorWorkload, updateTask, addRevision, assignTasks, createProject, getProjects, getProjectById, updateProject, createTask, getTaskById, updateTaskById, createRevision, getReminderCandidates, updateReminderLevel, receiveClientFeedback, segregateFeedback } from "../controllers/editing.controllers.js";
import { verifyJWT, verifyN8n, verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

// Existing Next.js routes
router.get("/", verifyJWT, getEditingData);
router.get("/workload", verifyJWT, getEditorWorkload);
router.put("/task/:taskId", verifyJWT, updateTask);
router.post("/revision", verifyJWT, addRevision);
router.post("/assign-tasks", verifyJWT, assignTasks);

// Editor Segregation (editor classifies client feedback as correction or revision)
router.put("/segregate/:revisionId", verifyJWT, segregateFeedback);

// N8N Dedicated Endpoints
router.post("/projects", verifyN8n, createProject);
router.get("/projects", verifyJWTOrN8N, getProjects);
router.get("/projects/:edit_id", verifyJWTOrN8N, getProjectById);
router.put("/projects/:edit_id", verifyN8n, updateProject);

router.post("/tasks", verifyN8n, createTask);
router.get("/tasks/:task_id", verifyJWTOrN8N, getTaskById);
router.put("/tasks/:task_id", verifyN8n, updateTaskById);

router.post("/revisions", verifyN8n, createRevision);

// New: n8n calls this instead of directly incrementing revision_count
// This sets status to 'Pending Segregation' for the editor to classify
router.post("/client-feedback", verifyN8n, receiveClientFeedback);

// TAT Reminder System (n8n)
router.get("/reminder-candidates", verifyN8n, getReminderCandidates);
router.put("/reminder-level", verifyN8n, updateReminderLevel);

export default router;
