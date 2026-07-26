import { Router } from "express";
import { getClients, createClient, updateClient } from "../controllers/client.controllers.js";
import { verifyJWT, verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWT, getClients);
router.post("/", verifyJWT, createClient);
router.put("/:leadId", verifyJWTOrN8N, updateClient);

export default router;
