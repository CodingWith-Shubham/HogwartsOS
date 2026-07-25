import { body } from "express-validator";

export const createProjectValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Project name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Project name must be between 3 and 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
];

export const updateProjectValidator = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Project name must be between 3 and 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
];

export const addMemberValidator = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("role")
    .optional()
    .isIn(["admin", "project_admin", "member"])
    .withMessage("Invalid role specified"),
];

export const updateRoleValidator = [
  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["admin", "project_admin", "member"])
    .withMessage("Invalid role specified"),
];
