import { body } from "express-validator";

export const createTaskValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Task title is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Task title must be between 3 and 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
  body("status")
    .optional()
    .isIn(["todo", "in_progress", "done"])
    .withMessage("Invalid status"),
  body("assignee")
    .optional()
    .isMongoId()
    .withMessage("Invalid assignee ID"),
];

export const updateTaskValidator = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Task title must be between 3 and 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
  body("status")
    .optional()
    .isIn(["todo", "in_progress", "done"])
    .withMessage("Invalid status"),
  body("assignee")
    .optional()
    .isMongoId()
    .withMessage("Invalid assignee ID"),
];

export const createSubtaskValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Subtask title is required")
    .isLength({ min: 3 })
    .withMessage("Subtask title must be at least 3 characters"),
];

export const updateSubtaskValidator = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage("Subtask title must be at least 3 characters"),
  body("isCompleted")
    .optional()
    .isBoolean()
    .withMessage("isCompleted must be a boolean"),
];
