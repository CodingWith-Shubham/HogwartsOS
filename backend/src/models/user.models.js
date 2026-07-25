import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema({
    empId: {
        type: String,
        unique: true,
        sparse: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        default: ""
    },
    designation: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        enum: ["manager", "sales", "editor", "shoot", "admin"],
        default: "sales"
    },
    initials: {
        type: String,
        default: ""
    },
    redirectTo: {
        type: String,
        default: "/dashboard"
    },
    password: {
        type: String,
        required: [true, "Password is required"]
    },
    avatar: {
        type: String,
        default: "https://placehold.co/200x200"
    },
    refreshToken: {
        type: String
    }
}, { timestamps: true });

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign({
        _id: this._id,
        email: this.email,
        username: this.username,
        role: this.role,
        name: this.name
    }, process.env.ACCESS_TOKEN_SECRET || "defaultSecretKey", {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d"
    });
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign({
        _id: this._id
    }, process.env.REFRESH_TOKEN_SECRET || "defaultRefreshKey", {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "10d"
    });
};

export const User = mongoose.model("User", userSchema);