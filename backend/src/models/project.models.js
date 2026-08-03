import mongoose, { Schema } from "mongoose";

const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      minlength: [3, "Project name must be at least 3 characters"],
      maxlength: [100, "Project name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    leadType: {
      type: String,
      enum: ['lead', 'upsell'],
      default: 'lead'
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Project owner is required"],
    },
    members: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["admin", "project_admin", "member"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    clientProfile: {
      type: Schema.Types.ObjectId,
      ref: "ClientProfile",
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ owner: 1 });
projectSchema.index({ "members.user": 1 });

export const Project = mongoose.model("Project", projectSchema);
export default Project;
