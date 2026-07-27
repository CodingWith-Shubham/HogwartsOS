
import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { sanitizeUser } from "../utils/sanitize-user.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.accessToken;

    if (!token) {
        throw new ApiError(401, "Unauthorized: No token provided", []);
    }

    try {  
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      req.user = decoded;
      const user = await User.findById(decoded?._id);
      if(!user){
        throw new ApiError(401, "Unauthorized: User not found", []);
      }
       req.user = sanitizeUser(user);
       next();
    } catch (error) {
    console.log("JWT ERROR:", error);
      throw new ApiError(401, "Unauthorized: Invalid token", []);
    }
   
});

export const verifyJWTOrN8N = asyncHandler(async (req, res, next) => {
  // Check if request is from n8n
  const n8nSecret = req.headers['x-n8n-secret'];
  if (n8nSecret && n8nSecret === process.env.N8N_SECRET) {
    // Valid n8n request — attach a system user and proceed
    req.user = { role: 'admin', _id: 'n8n-system' };
    return next();
  }

  // Otherwise fall through to normal JWT verification
  return verifyJWT(req, res, next);
});

export const verifyN8n = (req, res, next) => {
  const apiKey = req.header('x-api-key') || req.header('x-n8n-secret'); 
  if (!apiKey || apiKey !== process.env.N8N_SECRET) {
    return res.status(401).json({ error: 'Unauthorized via n8n' });
  }
  
  // Attach a mock system user so controllers relying on req.user don't crash
  req.user = { role: 'admin', _id: 'n8n-system', name: 'n8n-system' };
  next();
};