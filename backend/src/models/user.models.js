import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

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
    joiningDate: {
        type: Date,
        default: null
    },
    role: {
        type: String,
        enum: ["manager", "sales", "editor", "shoot", "admin", "super_admin", "marketing"],
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
    },
    emailVerificationToken: {
        type: String
    },
    emailVerificationExpiry: {
        type: Date
    },
    forgotPasswordToken: {
        type: String
    },
    forgotPasswordExpiry: {
        type: Date
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
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

userSchema.methods.generateTemporaryToken = function () {
    const unhashedToken = crypto.randomBytes(20).toString("hex");
    const hashedToken = crypto
        .createHash("sha256")
        .update(unhashedToken)
        .digest("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    return { unhashedToken, hashedToken, expiry };
};

export const User = mongoose.model("User", userSchema);
