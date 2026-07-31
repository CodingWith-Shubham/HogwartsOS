import mongoose from "mongoose";
import { User } from "../models/user.models.js";
import { sanitizeUser } from "../utils/sanitize-user.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import bcrypt from "bcrypt";

const getAllUsers = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.name) filter.name = { $regex: req.query.name, $options: 'i' };
    if (req.query.role) filter.role = req.query.role;
    
    const users = await User.find(filter).sort({ createdAt: 1 });
    const sanitized = users.map(u => sanitizeUser(u));
    return res.status(200).json(new ApiResponse(200, { users: sanitized }, "Users retrieved successfully"));
});

const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.password) {
        body.password = await bcrypt.hash(body.password, 10);
    }

    const query = mongoose.isValidObjectId(id) ? { _id: id } : { empId: id };

    const user = await User.findOneAndUpdate(
        query,
        { $set: body },
        { new: true }
    );

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res.status(200).json(new ApiResponse(200, { user: sanitizeUser(user) }, "User updated successfully"));
});

export { getAllUsers, updateUser };
