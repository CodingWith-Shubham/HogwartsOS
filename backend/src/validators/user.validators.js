import { z } from "zod";

export const registerUserSchema = z.object({
    username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(20),

    email: z.email("Invalid email"),

    fullName: z.string().optional(),

    password: z
        .string()
        .min(8, "Password must be at least 8 characters"),
});

export const loginUserSchema = z.object({
    email: z.email("Invalid email"),
    password: z.string().min(1, "Password is required")
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const forgotPasswordSchema = z.object({
    email: z.email("Invalid email"),
});

export const resetForgotPasswordSchema = z.object({
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
});
