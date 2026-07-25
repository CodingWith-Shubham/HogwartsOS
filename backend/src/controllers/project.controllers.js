import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Project } from "../models/project.models.js";
import { User } from "../models/user.models.js";

export const getProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({
    $or: [
      { owner: req.user._id },
      { "members.user": req.user._id },
    ],
  }).populate("owner", "fullName email").populate("members.user", "fullName email");

  res.status(200).json(
    new ApiResponse(200, projects, "Projects fetched successfully")
  );
});

export const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const project = await Project.create({
    name,
    description,
    owner: req.user._id,
    members: [
      {
        user: req.user._id,
        role: "admin",
      },
    ],
  });

  res.status(201).json(
    new ApiResponse(201, project, "Project created successfully")
  );
});

export const getProjectDetails = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId)
    .populate("owner", "fullName email")
    .populate("members.user", "fullName email");

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  res.status(200).json(
    new ApiResponse(200, project, "Project details fetched successfully")
  );
});

export const updateProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { name, description } = req.body;

  const project = await Project.findByIdAndUpdate(
    projectId,
    { name, description },
    { new: true, runValidators: true }
  );

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  res.status(200).json(
    new ApiResponse(200, project, "Project updated successfully")
  );
});

export const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findByIdAndDelete(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  res.status(200).json(
    new ApiResponse(200, null, "Project deleted successfully")
  );
});

export const getProjectMembers = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId).populate(
    "members.user",
    "fullName email"
  );

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  res.status(200).json(
    new ApiResponse(200, project.members, "Members fetched successfully")
  );
});

export const addProjectMember = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { email, role = "member" } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const memberExists = project.members.some(
    (member) => member.user.toString() === user._id.toString()
  );

  if (memberExists) {
    throw new ApiError(400, "User is already a member of this project");
  }

  project.members.push({
    user: user._id,
    role,
  });

  await project.save();

  res.status(201).json(
    new ApiResponse(201, project.members, "Member added successfully")
  );
});

export const updateMemberRole = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;
  const { role } = req.body;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const member = project.members.find(
    (m) => m.user.toString() === userId
  );

  if (!member) {
    throw new ApiError(404, "Member not found in this project");
  }

  member.role = role;
  await project.save();

  res.status(200).json(
    new ApiResponse(200, member, "Member role updated successfully")
  );
});

export const removeProjectMember = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  project.members = project.members.filter(
    (m) => m.user.toString() !== userId
  );

  await project.save();

  res.status(200).json(
    new ApiResponse(200, null, "Member removed successfully")
  );
});
