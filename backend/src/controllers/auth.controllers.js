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
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error);
    throw new ApiError(500, "Error generating tokens", [], error.stack);
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, role } = req.body;
  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    throw new ApiError(409, "Username or email already exists", []);
  }
  const user = await User.create({
    username,
    email,
    password,
    role,
    isEmailVerified: false,
  });

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
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        createdUser: sanitizeUser(createdUser),
      },
      "User registered successfully. Email verification link is sent to your email that is valid for 20 minutes.",
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
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password", []);
  }
  const { accessToken, refreshToken } = await generateAccessandRefreshToken(
    user._id,
  );
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
  res.cookie("refreshToken", refreshToken, options);
  res.cookie("accessToken", accessToken, options);
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        accessToken,
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
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null }, { new: true });
  const options = {
    httpOnly: true,
    secure: true
  }
  return res.status(200).clearCookie("refreshToken", options).clearCookie("accessToken", options).json(new ApiResponse(200, {}, "Logout successful"))
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
    if(!user || user.refreshToken !== refreshToken){
      throw new ApiError(401, "Unauthorized: Invalid refresh token", []);
    }
    const options = {
      httpOnly: true,
      secure: true,
    }
    const { accessToken, refreshToken: newRefreshToken } = await generateAccessandRefreshToken(user._id);
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", newRefreshToken, options).json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed successfully"));

  } catch (error) {
    throw new ApiError(401, "Unauthorized: Invalid refresh token", []);
  }
});

const forgotPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User with this email does not exist", []);
  }
  const { unhashedToken, hashedToken, expiry } = user.generateTemporaryToken();
  user.forgotPasswordToken = hashedToken;
  user.forgotPasswordExpiry = expiry;
  await user.save({ validateBeforeSave: false });
  await sendMail({
    email: user.email,
    subject: "Password Reset Request",
    mailgenContent: forgotPasswordMailgenContent(
    user.username,
    `${process.env.FORGOT_PASSWORD_URL}/${unhashedToken}`,
    ),
  });
  return res.status(200).json(new ApiResponse(200, {}, "Password reset link has been sent to your email"));
}); 

const resetForgotPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() },
  });
  if (!user) {
    throw new ApiError(489, "Invalid or expired password reset token", []);
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
