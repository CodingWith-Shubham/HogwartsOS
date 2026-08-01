import mongoose, { Schema } from "mongoose";

const correctionSchema = new Schema({
  projectId: {
    type: String,
    required: true,
    index: true
  },
  editingTaskId: {
    type: String,
    required: true,
    index: true
  },
  editorName: { type: String, default: "" },
  editorId: { type: String, default: "" },
  raisedBy: { type: String, required: true },
  raisedByName: { type: String, default: "" },
  note: { type: String, required: true },
  round: { type: Number, default: 1 },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

export const Correction = mongoose.model("Correction", correctionSchema);
