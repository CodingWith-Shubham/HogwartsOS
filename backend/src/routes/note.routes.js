import { Router } from "express";
import * as noteController from "../controllers/note.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router({ mergeParams: true });

router.use(verifyJWT);

router
  .route("/:projectId")
  .get(noteController.getNotes)
  .post(noteController.createNote);

router
  .route("/:projectId/n/:noteId")
  .get(noteController.getNoteDetails)
  .put(noteController.updateNote)
  .delete(noteController.deleteNote);

export default router;
