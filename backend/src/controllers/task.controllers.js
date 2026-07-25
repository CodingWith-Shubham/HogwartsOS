import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Task } from "../models/task.models.js";

export const getTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const tasks = await Task.find({ project: projectId })
    .populate("assignee", "fullName email")
    .populate("createdBy", "fullName email");

  res.status(200).json(
    new ApiResponse(200, tasks, "Tasks fetched successfully")
  );
});

export const createTask = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { title, description, status = "todo", assignee } = req.body;

  const task = await Task.create({
    title,
    description,
    project: projectId,
    status,
    assignee,
    createdBy: req.user._id,
  });

  await task.populate("assignee", "fullName email");
  await task.populate("createdBy", "fullName email");

  res.status(201).json(
    new ApiResponse(201, task, "Task created successfully")
  );
});

export const getTaskDetails = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;

  const task = await Task.findOne({
    _id: taskId,
    project: projectId,
  })
    .populate("assignee", "fullName email")
    .populate("createdBy", "fullName email")
    .populate("subtasks.completedBy", "fullName email");

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  res.status(200).json(
    new ApiResponse(200, task, "Task details fetched successfully")
  );
});

export const updateTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { title, description, status, assignee } = req.body;

  const task = await Task.findOneAndUpdate(
    { _id: taskId, project: projectId },
    { title, description, status, assignee },
    { new: true, runValidators: true }
  )
    .populate("assignee", "fullName email")
    .populate("createdBy", "fullName email");

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  res.status(200).json(
    new ApiResponse(200, task, "Task updated successfully")
  );
});

export const deleteTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;

  const task = await Task.findOneAndDelete({
    _id: taskId,
    project: projectId,
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  res.status(200).json(
    new ApiResponse(200, null, "Task deleted successfully")
  );
});

export const createSubtask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { title } = req.body;

  const task = await Task.findOne({
    _id: taskId,
    project: projectId,
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const subtask = {
    title,
    isCompleted: false,
  };

  task.subtasks.push(subtask);
  await task.save();

  res.status(201).json(
    new ApiResponse(201, task.subtasks, "Subtask created successfully")
  );
});

export const updateSubtask = asyncHandler(async (req, res) => {
  const { projectId, subTaskId } = req.params;
  const { title, isCompleted } = req.body;

  const task = await Task.findOne({
    project: projectId,
    "subtasks._id": subTaskId,
  });

  if (!task) {
    throw new ApiError(404, "Subtask not found");
  }

  const subtask = task.subtasks.id(subTaskId);
  if (!subtask) {
    throw new ApiError(404, "Subtask not found");
  }

  if (title) subtask.title = title;
  if (isCompleted !== undefined) {
    subtask.isCompleted = isCompleted;
    if (isCompleted) {
      subtask.completedBy = req.user._id;
      subtask.completedAt = new Date();
    } else {
      subtask.completedBy = null;
      subtask.completedAt = null;
    }
  }

  await task.save();
  await task.populate("subtasks.completedBy", "fullName email");

  res.status(200).json(
    new ApiResponse(200, subtask, "Subtask updated successfully")
  );
});

export const deleteSubtask = asyncHandler(async (req, res) => {
  const { projectId, subTaskId } = req.params;

  const task = await Task.findOne({
    project: projectId,
    "subtasks._id": subTaskId,
  });

  if (!task) {
    throw new ApiError(404, "Subtask not found");
  }

  task.subtasks.id(subTaskId).deleteOne();
  await task.save();

  res.status(200).json(
    new ApiResponse(200, null, "Subtask deleted successfully")
  );
});
