import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Note } from "../models/note.models.js";

export const getNotes = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const notes = await Note.find({ project: projectId })
    .populate("author", "fullName email");

  res.status(200).json(
    new ApiResponse(200, notes, "Notes fetched successfully")
  );
});

export const createNote = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { title, content } = req.body;

  const note = await Note.create({
    title,
    content,
    project: projectId,
    author: req.user._id,
  });

  await note.populate("author", "fullName email");

  res.status(201).json(
    new ApiResponse(201, note, "Note created successfully")
  );
});

export const getNoteDetails = asyncHandler(async (req, res) => {
  const { projectId, noteId } = req.params;

  const note = await Note.findOne({
    _id: noteId,
    project: projectId,
  }).populate("author", "fullName email");

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  res.status(200).json(
    new ApiResponse(200, note, "Note details fetched successfully")
  );
});

export const updateNote = asyncHandler(async (req, res) => {
  const { projectId, noteId } = req.params;
  const { title, content } = req.body;

  const note = await Note.findOneAndUpdate(
    { _id: noteId, project: projectId },
    { title, content },
    { new: true, runValidators: true }
  ).populate("author", "fullName email");

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  res.status(200).json(
    new ApiResponse(200, note, "Note updated successfully")
  );
});

export const deleteNote = asyncHandler(async (req, res) => {
  const { projectId, noteId } = req.params;

  const note = await Note.findOneAndDelete({
    _id: noteId,
    project: projectId,
  });

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  res.status(200).json(
    new ApiResponse(200, null, "Note deleted successfully")
  );
});
