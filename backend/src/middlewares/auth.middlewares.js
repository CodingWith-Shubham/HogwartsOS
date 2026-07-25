
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