import { Router } from "express";
import { getAllUsers, updateUser } from "../controllers/user.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWT, getAllUsers);
router.put("/:id", verifyJWT, updateUser);

export default router;
