import { body } from "express-validator";

export const createNoteValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Note title is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Note title must be between 3 and 200 characters"),
  body("content")
    .trim()
    .notEmpty()
    .withMessage("Note content is required")
    .isLength({ min: 3, max: 5000 })
    .withMessage("Note content must be between 3 and 5000 characters"),
];

export const updateNoteValidator = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Note title must be between 3 and 200 characters"),
  body("content")
    .optional()
    .trim()
    .isLength({ min: 3, max: 5000 })
    .withMessage("Note content must be between 3 and 5000 characters"),
];
