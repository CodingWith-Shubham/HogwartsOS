import { Router } from "express";
import { getAllUsers, updateUser, deleteUser } from "../controllers/user.controllers.js";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWTOrN8N, getAllUsers);
router.put("/:id", verifyJWTOrN8N, updateUser);
router.delete("/:id", verifyJWTOrN8N, deleteUser);

export default router;
