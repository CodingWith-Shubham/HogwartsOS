import { Router } from "express";
import { verifyJWTOrN8N } from "../middlewares/auth.middlewares.js";
import {
    createUpsellCrossSell,
    getUpsellCrossSells,
    getUpsellCrossSellById,
    getPendingEditorAssignment,
    getClientsUpsellSummary,
    getUpsellCrossSellMetrics,
    updateUpsellCrossSell,
    updateUpsellCrossSellStatus,
    updateProposalResponse,
    assignEditorToUpsell,
    deleteUpsellCrossSell
} from "../controllers/upsellCrossSell.controller.js";

/**
 * Upsell & Cross-Sell routes — a completely SEPARATE pipeline from the Lead
 * routes. Nothing here touches the sales lead dashboard, Client lead records,
 * or the W1–W6 webhooks. All routes are protected (super admin / manager / sales rep).
 */
const router = Router();

router.route("/")
    .get(verifyJWTOrN8N, getUpsellCrossSells)
    .post(verifyJWTOrN8N, createUpsellCrossSell);

router.route("/metrics/summary").get(verifyJWTOrN8N, getUpsellCrossSellMetrics);
router.route("/clients/summary").get(verifyJWTOrN8N, getClientsUpsellSummary);
router.route("/pending-editor-assignment").get(verifyJWTOrN8N, getPendingEditorAssignment);

router.route("/:id")
    .get(verifyJWTOrN8N, getUpsellCrossSellById)
    .patch(verifyJWTOrN8N, updateUpsellCrossSell)
    .delete(verifyJWTOrN8N, deleteUpsellCrossSell);

router.route("/:id/status").patch(verifyJWTOrN8N, updateUpsellCrossSellStatus);
router.route("/:id/proposal-response").patch(verifyJWTOrN8N, updateProposalResponse);
router.route("/:id/assign-editor").patch(verifyJWTOrN8N, assignEditorToUpsell);

export default router;
