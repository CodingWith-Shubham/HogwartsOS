import { Router } from "express";
import { getClients, createClient, updateClient, getClientByLeadId, deleteClient } from "../controllers/client.controllers.js";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", verifyJWTOrN8N, getClients);
router.get("/:leadId", verifyJWTOrN8N, getClientByLeadId);
router.post("/", verifyJWTOrN8N, createClient);
router.put("/:leadId", verifyJWTOrN8N, updateClient);
router.delete("/:leadId", verifyJWTOrN8N, deleteClient);

export default router;
