import { Router } from "express";
import { getShoots, createShoot, updateShoot } from "../controllers/shoot.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWT, getShoots);
router.post("/", verifyJWT, createShoot);
router.put("/:shootId", verifyJWT, updateShoot);

export default router;
