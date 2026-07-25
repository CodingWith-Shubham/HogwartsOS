import { Router } from "express";
import { getEditingData, updateTask, addRevision } from "../controllers/editing.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWT, getEditingData);
router.put("/task/:taskId", verifyJWT, updateTask);
router.post("/revision", verifyJWT, addRevision);

export default router;
