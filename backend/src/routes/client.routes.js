import { Router } from "express";
import { getClients, createClient, updateClient } from "../controllers/client.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWT, getClients);
router.post("/", verifyJWT, createClient);
router.put("/:leadId", verifyJWT, updateClient);

export default router;
