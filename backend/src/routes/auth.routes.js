import { Router } from "express";
import { registerUser, verifyEmail, loginUser, logoutUser, resendVerificationEmail, getCurrentUser, refreshAccessToken, forgotPasswordRequest, resetForgotPassword, changePassword} from "../controllers/auth.controllers.js";;
import { validate } from "../middlewares/validator.middlewares.js";
import {registerUserSchema, loginUserSchema, changePasswordSchema, forgotPasswordSchema, resetForgotPasswordSchema} from "../validators/user.validators.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
const router = Router();

//unsecure routes
router.post('/register', validate(registerUserSchema), registerUser);
router.post('/login', validate(loginUserSchema), loginUser);
router.get("/verify-email/:token", verifyEmail);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPasswordRequest);
router.post('/reset-password/:token', validate(resetForgotPasswordSchema), resetForgotPassword);
//secure routes
router.post('/logout', verifyJWT, logoutUser);
router.post('/resend-verification-email', verifyJWT, resendVerificationEmail);
router.get('/me', verifyJWT, getCurrentUser);
router.post('/refresh-token', refreshAccessToken);

router.post('/change-password', validate(changePasswordSchema), verifyJWT, changePassword);

export default router;