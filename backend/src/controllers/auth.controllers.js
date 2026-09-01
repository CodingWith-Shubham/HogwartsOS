import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import sendMail from "../utils/mail.js";
import { sanitizeUser } from "../utils/sanitize-user.js";
import jwt from "jsonwebtoken";
import {
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
} from "../utils/mail.js";
import crypto from "crypto";

const generateAccessandRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    // Keep at most 5 active sessions (removes the oldest when limit is reached)
    const tokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
    user.refreshTokens = [...tokens.slice(-4), refreshToken];
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error);
    throw new ApiError(500, "Error generating tokens", [], error.stack);
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, role, name, fullName, phone, designation, redirectTo, empId } = req.body;
  const displayName = (name || fullName || username || '').trim();

  const normalizedEmail = email ? email.toLowerCase().trim() : '';
  const normalizedUsername = username ? username.toLowerCase().trim() : '';

  const existingUser = await User.findOne({
    $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
  });

  if (existingUser) {
    throw new ApiError(409, "Username or email already exists", []);
  }

  const generatedEmpId = empId || `u_${Date.now().toString(36)}`;
  const initials = displayName
    ? displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 3)
    : "EMP";

  const user = await User.create({
    empId: generatedEmpId,
    username: normalizedUsername,
    email: normalizedEmail,
    name: displayName,
    password,
    role: role || "sales",
    phone: phone || "",
    designation: designation || "",
    initials,
    redirectTo: redirectTo || (role === 'manager' ? '/manager' : role === 'sales' ? '/sales' : role === 'editor' ? '/editor' : '/shoot'),
    isEmailVerified: true,
  });

  // Attempt verification email if configured, but do not fail user registration if email fails
  try {
    const { unhashedToken, hashedToken, expiry } = user.generateTemporaryToken();
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = expiry;
    await user.save({ validateBeforeSave: false });
    const verificationUrl = `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${unhashedToken}`;
    console.log("Verification URL:", verificationUrl);
    await sendMail({
      email: user.email,
      subject: "Email Verification",
      mailgenContent: emailVerificationMailgenContent(
        user.username,
        verificationUrl,
      ),
    });
  } catch (mailErr) {
    console.warn("Verification email not sent:", mailErr?.message || mailErr);
  }

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  const sanitized = sanitizeUser(createdUser);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        createdUser: sanitized,
        user: sanitized,
      },
      "User registered successfully.",
    ),
  );
});

const loginUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if(!email){
    throw new ApiError(400, "Email is required", []);
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, "Invalid email or password", []);
  }
  if (user.isActive === false) {
    throw new ApiError(403, "Your account has been deactivated. Please contact an administrator.", []);
  }
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password", []);
  }
  const { accessToken, refreshToken } = await generateAccessandRefreshToken(
    user._id,
  );
  const accessOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,   // 30 days
  };
  const refreshCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 365 * 24 * 60 * 60 * 1000,  // 365 days
  };
  res.cookie("accessToken", accessToken, accessOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        accessToken,
        refreshToken,
        user: sanitizeUser(user),
      },
      "Login successful",
    ),
  );
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, "User not found or token expired");
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Email verified successfully."));
});

const logoutUser = asyncHandler(async (req, res) => {
  // Remove only the current device's refresh token so other sessions stay active
  const currentRefreshToken = req.cookies?.refreshToken;
  if (currentRefreshToken) {
    await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { refreshTokens: currentRefreshToken } },
      { new: true }
    );
  }
  const options = {
    httpOnly: true,
    secure: true
  }
  return res.status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "Logout successful"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const sanitized = sanitizeUser(user);
  return res.status(200).json(new ApiResponse(200, { user: sanitized }, "Current user fetched successfully"));
});

const resendVerificationEmail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user.isEmailVerified) {
    throw new ApiError(400, "Email is already verified", []);
  }
  const { unhashedToken, hashedToken, expiry } = user.generateTemporaryToken();
  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = expiry;
  await user.save({ validateBeforeSave: false });
  const verificationUrl = `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${unhashedToken}`;
  await sendMail({
    email: user.email,
    subject: "Email Verification",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      verificationUrl,

    ),
  });
  return res.status(200).json(new ApiResponse(200, {}, "Verification email resent successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    throw new ApiError(401, "Unauthorized: No refresh token provided", []);
  }
  try {
    const decodedToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decodedToken._id);
    if (!user || !Array.isArray(user.refreshTokens) || !user.refreshTokens.includes(refreshToken)) {
      throw new ApiError(401, "Unauthorized: Invalid refresh token", []);
    }
    const accessOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    }
    const refreshOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 365 * 24 * 60 * 60 * 1000, // 365 days
    }
    // Rotate: remove old token, add new one (token rotation for security)
    await User.findByIdAndUpdate(user._id, { $pull: { refreshTokens: refreshToken } });
    const { accessToken, refreshToken: newRefreshToken } = await generateAccessandRefreshToken(user._id);

    return res.status(200)
      .cookie("accessToken", accessToken, accessOptions)
      .cookie("refreshToken", newRefreshToken, refreshOptions)
      .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed successfully"));

  } catch (error) {
    throw new ApiError(401, "Unauthorized: Invalid refresh token", []);
  }
});

const forgotPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedInput = email ? email.toLowerCase().trim() : "";
  const user = await User.findOne({
    $or: [{ email: normalizedInput }, { username: normalizedInput }]
  });
  if (!user) {
    throw new ApiError(404, "User with this email or username does not exist", []);
  }
  const { unhashedToken, hashedToken, expiry } = user.generateTemporaryToken();
  user.forgotPasswordToken = hashedToken;
  user.forgotPasswordExpiry = expiry;
  await user.save({ validateBeforeSave: false });

  const forgotPasswordBase = process.env.FORGOT_PASSWORD_URL || "http://localhost:3000/reset-password";
  const resetUrl = `${forgotPasswordBase.replace(/\/+$/, '')}/${unhashedToken}`;

  try {
    await sendMail({
      email: user.email,
      subject: "Password Reset Request",
      mailgenContent: forgotPasswordMailgenContent(
        user.username || user.name || "User",
        resetUrl,
      ),
    });
  } catch (mailErr) {
    console.error("Failed to send password reset email:", mailErr);
    throw new ApiError(500, "Failed to send password reset email. Please verify backend email configuration.");
  }

  return res.status(200).json(new ApiResponse(200, {}, `Password reset link has been sent to ${user.email}`));
}); 

const resetForgotPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  if (!token) {
    throw new ApiError(400, "Reset token is required");
  }
  const hashedToken = crypto.createHash("sha256").update(token.trim()).digest("hex");
  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: new Date() },
  });
  if (!user) {
    throw new ApiError(400, "Invalid or expired password reset token", []);
  }
  user.password = newPassword;
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;
  await user.save();
  return res.status(200).json(new ApiResponse(200, {}, "Password has been reset successfully"));
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  const isPasswordValid = await user.isPasswordCorrect(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError(401, "Current password is incorrect", []);
  }
  user.password = newPassword;
  await user.save();
  return res.status(200).json(new ApiResponse(200, {}, "Password has been changed successfully"));
});

export { registerUser, verifyEmail, loginUser, logoutUser, resendVerificationEmail, getCurrentUser, refreshAccessToken, forgotPasswordRequest, resetForgotPassword, changePassword };
