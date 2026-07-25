import mongoose, { Schema } from "mongoose";

const subtaskSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Subtask title is required"],
      trim: true,
      minlength: [3, "Subtask title must be at least 3 characters"],
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const taskSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      minlength: [3, "Task title must be at least 3 characters"],
      maxlength: [200, "Task title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project is required"],
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "done"],
      default: "todo",
    },
    assignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    subtasks: [subtaskSchema],
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        mimeType: String,
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ project: 1 });
taskSchema.index({ assignee: 1 });
taskSchema.index({ status: 1 });

export const Task = mongoose.model("Task", taskSchema);
export default Task;
