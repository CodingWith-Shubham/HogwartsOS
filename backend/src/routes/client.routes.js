import { Router } from "express";
import { getClients, createClient, updateClient } from "../controllers/client.controllers.js";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWTOrN8N, getClients);
router.post("/", verifyJWTOrN8N, createClient);
router.put("/:leadId", verifyJWTOrN8N, updateClient);

export default router;
