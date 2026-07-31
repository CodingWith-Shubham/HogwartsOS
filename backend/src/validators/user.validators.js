import { z } from "zod";

export const registerUserSchema = z.object({
    username: z.string().min(2, "Username must be at least 2 characters"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().optional(),
    fullName: z.string().optional(),
    role: z.string().optional(),
    phone: z.string().optional(),
    designation: z.string().optional(),
    redirectTo: z.string().optional(),
    empId: z.string().optional(),
}).passthrough();

export const loginUserSchema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(1, "Password is required")
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email"),
});

export const resetForgotPasswordSchema = z.object({
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
});
