import mongoose, { Schema } from "mongoose";

const noteSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Note title is required"],
      trim: true,
      minlength: [3, "Note title must be at least 3 characters"],
      maxlength: [200, "Note title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Note content is required"],
      minlength: [3, "Note content must be at least 3 characters"],
      maxlength: [5000, "Note content cannot exceed 5000 characters"],
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project is required"],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author is required"],
    },
  },
  {
    timestamps: true,
  }
);

noteSchema.index({ project: 1 });
noteSchema.index({ author: 1 });

export const Note = mongoose.model("Note", noteSchema);
export default Note;
