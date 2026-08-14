import { ClientProfile } from "../models/clientProfile.models.js";
import { Project } from "../models/project.models.js";
import { EditProject } from "../models/editing.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate client profile fields and return an error message (or null if valid).
 */
const validateProfileFields = ({ name, email, phone }) => {
  if (!name || !name.trim()) {
    return "Client name is required.";
  }
  if (email && email.trim() && !EMAIL_REGEX.test(email.trim())) {
    return "Invalid email format.";
  }
  if (phone && phone.trim()) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      return "Mobile number must contain at least 10 digits.";
    }
  }
  return null;
};

/**
 * Check uniqueness of email and phone, excluding a given profile id (for updates).
 * Returns an error message string or null.
 */
const checkUniqueness = async ({ email, phone, excludeId }) => {
  if (email && email.trim()) {
    const byEmail = await ClientProfile.findOne({
      email: email.trim().toLowerCase(),
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (byEmail) return "A client with this email already exists.";
  }

  if (phone && phone.trim()) {
    const byPhone = await ClientProfile.findOne({
      phone: phone.trim(),
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (byPhone) return "A client with this mobile number already exists.";
  }

  return null;
};

/**
 * Check if a client profile already exists based on email or phone.
 * (Narrowed from the old version that also matched name/company.)
 */
const findDuplicateClientProfile = async ({ email, phone, name }) => {
  if (email && email.trim()) {
    const byEmail = await ClientProfile.findOne({ email: email.trim().toLowerCase() });
    if (byEmail) return byEmail;
  }

  if (phone && phone.trim()) {
    const byPhone = await ClientProfile.findOne({ phone: phone.trim() });
    if (byPhone) return byPhone;
  }

  // Fallback to name if email and phone are not present or didn't match
  if (name && name.trim()) {
    // Case-insensitive exact match for name
    const byName = await ClientProfile.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, "i") } });
    if (byName) return byName;
  }

  return null;
};

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * Check for duplicate client profile (API Endpoint)
 */
export const checkDuplicateProfile = asyncHandler(async (req, res) => {
  const { email, phone, name } = req.body;
  const duplicate = await findDuplicateClientProfile({ email, phone, name });

  return res.status(200).json(
    new ApiResponse(200, {
      exists: Boolean(duplicate),
      profile: duplicate,
    }, duplicate ? "Duplicate client profile found" : "No duplicate client profile found")
  );
});

/**
 * Create a new Client Profile
 * Sales Members, Managers, Editors, Admins, and Super Admins
 */
export const createClientProfile = asyncHandler(async (req, res) => {
  const userRole = req.user?.role;
  if (!["sales", "manager", "admin", "editor", "super_admin"].includes(userRole)) {
    throw new ApiError(403, "Access denied: You do not have permission to create client profiles");
  }

  const {
    name,
    email,
    phone,
    companyName,
    country,
    timezone,
    preferredCommunication,
    alternateContact,
    budgetRange,
    paymentMethod,
    leadSource,
    businessType,
    internalNotes,
    specialInstructions,
    clientStatus,
    preferredEditingStyle,
    preferredLanguage,
    brandingGuidelines,
    colorPreferences,
    fontPreferences,
    musicPreferences,
    subtitlePreferences,
    deliveryFormat,
    revisionExpectations,
    turnaroundPreference,
    additionalPreferences,
    editorPreferences,
    allowDuplicate,
  } = req.body;

  // Field validation
  const validationError = validateProfileFields({ name, email, phone });
  if (validationError) {
    throw new ApiError(400, validationError);
  }

  // Uniqueness check
  const uniquenessError = await checkUniqueness({ email, phone });
  if (uniquenessError) {
    throw new ApiError(409, uniquenessError);
  }

  // Automatic duplicate check (broader — also returns the profile)
  if (!allowDuplicate) {
    const existing = await findDuplicateClientProfile({ email, phone, name });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A matching client profile already exists",
        isDuplicate: true,
        existingProfile: existing,
      });
    }
  }

  const profileData = {
    name: name.trim(),
    email: email ? email.trim().toLowerCase() : "",
    phone: phone ? phone.trim() : "",
    companyName: companyName ? companyName.trim() : "",
    country: country ? country.trim() : "",
    timezone: timezone ? timezone.trim() : "",
    preferredCommunication: preferredCommunication ? preferredCommunication.trim() : "",
    alternateContact: alternateContact ? alternateContact.trim() : "",
    budgetRange: budgetRange || "",
    paymentMethod: paymentMethod || "",
    leadSource: leadSource || "",
    businessType: businessType || "",
    internalNotes: internalNotes || "",
    specialInstructions: specialInstructions || "",
    clientStatus: clientStatus || "Active",
    preferredEditingStyle: preferredEditingStyle || "",
    preferredLanguage: preferredLanguage || "",
    brandingGuidelines: brandingGuidelines || "",
    colorPreferences: colorPreferences || "",
    fontPreferences: fontPreferences || "",
    musicPreferences: musicPreferences || "",
    subtitlePreferences: subtitlePreferences || "",
    deliveryFormat: deliveryFormat || "",
    revisionExpectations: revisionExpectations || "",
    turnaroundPreference: turnaroundPreference || "",
    additionalPreferences: additionalPreferences || "",
    editorPreferences: editorPreferences || {},
    previousProjects: [],
    createdBy: req.user._id,
    lastUpdatedBy: req.user._id,
  };

  const newProfile = await ClientProfile.create(profileData);

  return res
    .status(201)
    .json(new ApiResponse(201, { profile: newProfile }, "Client profile created successfully"));
});

/**
 * Get all Client Profiles with search & filters
 * Sales, Manager, Editor, Admin
 */
export const getAllClientProfiles = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 50 } = req.query;

  const query = {};

  if (status) {
    query.clientStatus = status;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { companyName: searchRegex },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [profiles, total] = await Promise.all([
    ClientProfile.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email")
      .populate("lastUpdatedBy", "name email")
      .lean(),
    ClientProfile.countDocuments(query),
  ]);

  // Fetch project count for each profile
  const profileIds = profiles.map((p) => p._id);
  const projects = await EditProject.find({ clientProfile: { $in: profileIds } }).lean();

  const profilesWithStats = profiles.map((p) => {
    const linkedProjects = projects.filter(
      (proj) => proj.clientProfile && proj.clientProfile.toString() === p._id.toString()
    );
    return {
      ...p,
      projectCount: linkedProjects.length,
    };
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        profiles: profilesWithStats,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
      "Client profiles fetched successfully"
    )
  );
});

/**
 * Get single Client Profile by ID
 * Sales, Manager, Editor, Admin
 */
export const getSingleClientProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const profile = await ClientProfile.findById(id)
    .populate("createdBy", "name email role")
    .populate("lastUpdatedBy", "name email role")
    .populate("previousProjects");

  if (!profile) {
    throw new ApiError(404, "Client profile not found");
  }

  // Fetch Project History for this client profile (auto-linked via clientProfile ref or email)
  const linkedProjects = await EditProject.find({
    $or: [
      { clientProfile: profile._id },
      { emailId: profile.email ? profile.email : "NON_EXISTENT_EMAIL" },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  const formattedHistory = linkedProjects.map((p) => ({
    id: p._id,
    editId: p.editId,
    clientName: p.clientName || profile.name,
    serviceType: p.serviceType || "Video Edit",
    assignedEditor: p.editorName || "Unassigned",
    deliveryDate: p.editDeliveryDate || p.deadlineAt || "",
    status: p.status || "In Progress",
    revisionCount: p.revisionCount || 0,
    managerComment: p.managerComment || "",
    createdAt: p.createdAt,
  }));

  // Format manually-linked previous projects
  const formattedPreviousProjects = (profile.previousProjects || []).map((p) => ({
    id: p._id,
    editId: p.editId,
    clientName: p.clientName || profile.name,
    serviceType: p.serviceType || "Video Edit",
    assignedEditor: p.editorName || "Unassigned",
    deliveryDate: p.editDeliveryDate || p.deadlineAt || "",
    status: p.status || "In Progress",
    revisionCount: p.revisionCount || 0,
    createdAt: p.createdAt,
  }));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        profile,
        projectHistory: formattedHistory,
        previousProjects: formattedPreviousProjects,
      },
      "Client profile details retrieved"
    )
  );
});

/**
 * Update Client Profile — all permitted roles can update ALL fields
 * Sales, Manager, Editor, Admin
 */
export const updateClientProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userRole = req.user?.role;

  if (!["sales", "manager", "admin", "editor", "super_admin"].includes(userRole)) {
    throw new ApiError(403, "Unauthorized to edit this client profile");
  }

  const profile = await ClientProfile.findById(id);
  if (!profile) {
    throw new ApiError(404, "Client profile not found");
  }

  // Field validation
  const validationError = validateProfileFields({
    name: req.body.name !== undefined ? req.body.name : profile.name,
    email: req.body.email !== undefined ? req.body.email : profile.email,
    phone: req.body.phone !== undefined ? req.body.phone : profile.phone,
  });
  if (validationError) {
    throw new ApiError(400, validationError);
  }

  // Uniqueness check (exclude self)
  const uniquenessError = await checkUniqueness({
    email: req.body.email !== undefined ? req.body.email : profile.email,
    phone: req.body.phone !== undefined ? req.body.phone : profile.phone,
    excludeId: id,
  });
  if (uniquenessError) {
    throw new ApiError(409, uniquenessError);
  }

  // All roles can update all fields
  const allowedFields = [
    "name",
    "email",
    "phone",
    "companyName",
    "country",
    "timezone",
    "preferredCommunication",
    "alternateContact",
    "budgetRange",
    "paymentMethod",
    "leadSource",
    "businessType",
    "internalNotes",
    "specialInstructions",
    "clientStatus",
    "preferredEditingStyle",
    "preferredLanguage",
    "brandingGuidelines",
    "colorPreferences",
    "fontPreferences",
    "musicPreferences",
    "subtitlePreferences",
    "deliveryFormat",
    "revisionExpectations",
    "turnaroundPreference",
    "additionalPreferences",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      profile[field] = req.body[field];
    }
  });

  // Editor preferences — any role can update
  if (req.body.editorPreferences) {
    profile.editorPreferences = {
      ...profile.editorPreferences,
      ...req.body.editorPreferences,
    };
  }

  profile.lastUpdatedBy = req.user._id;
  await profile.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { profile }, "Client profile updated successfully"));
});

/**
 * Delete Client Profile (Manager & Admin only)
 */
export const deleteClientProfile = asyncHandler(async (req, res) => {
  const userRole = req.user?.role;
  if (!["manager", "admin", "super_admin"].includes(userRole)) {
    throw new ApiError(403, "Access denied: Only Managers and Admins can delete client profiles");
  }

  const { id } = req.params;
  const profile = await ClientProfile.findById(id);

  if (!profile) {
    throw new ApiError(404, "Client profile not found");
  }

  await ClientProfile.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Client profile deleted successfully"));
});

// ─── Previous Projects Management ─────────────────────────────────────────────

/**
 * Add a previous project to a client profile
 * POST /:id/previous-projects  body: { projectId }
 */
export const addPreviousProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { projectId } = req.body;

  if (!projectId) {
    throw new ApiError(400, "Project ID is required.");
  }

  const profile = await ClientProfile.findById(id);
  if (!profile) {
    throw new ApiError(404, "Client profile not found");
  }

  // Check project exists
  const project = await EditProject.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Prevent duplicates
  const alreadyLinked = profile.previousProjects.some(
    (pid) => pid.toString() === projectId.toString()
  );
  if (alreadyLinked) {
    throw new ApiError(409, "This project is already linked to this client profile.");
  }

  profile.previousProjects.push(projectId);
  profile.lastUpdatedBy = req.user._id;
  await profile.save();

  // Return the populated project info
  const populatedProject = await EditProject.findById(projectId).lean();

  return res.status(200).json(
    new ApiResponse(200, {
      project: {
        id: populatedProject._id,
        editId: populatedProject.editId,
        clientName: populatedProject.clientName || "",
        serviceType: populatedProject.serviceType || "Video Edit",
        assignedEditor: populatedProject.editorName || "Unassigned",
        deliveryDate: populatedProject.editDeliveryDate || populatedProject.deadlineAt || "",
        status: populatedProject.status || "In Progress",
        revisionCount: populatedProject.revisionCount || 0,
        createdAt: populatedProject.createdAt,
      },
    }, "Project linked to client profile")
  );
});

/**
 * Remove a previous project from a client profile
 * DELETE /:id/previous-projects/:projectId
 */
export const removePreviousProject = asyncHandler(async (req, res) => {
  const { id, projectId } = req.params;

  const profile = await ClientProfile.findById(id);
  if (!profile) {
    throw new ApiError(404, "Client profile not found");
  }

  const idx = profile.previousProjects.findIndex(
    (pid) => pid.toString() === projectId.toString()
  );
  if (idx === -1) {
    throw new ApiError(404, "Project is not linked to this client profile.");
  }

  profile.previousProjects.splice(idx, 1);
  profile.lastUpdatedBy = req.user._id;
  await profile.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Project removed from client profile"));
});

/**
 * Search all EditProject records (for the "Add Previous Project" dropdown)
 * GET /:id/search-projects?q=searchTerm
 */
export const searchProjects = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { q } = req.query;

  const profile = await ClientProfile.findById(id);
  if (!profile) {
    throw new ApiError(404, "Client profile not found");
  }

  const searchQuery = {};
  if (q && q.trim()) {
    const searchRegex = new RegExp(q.trim(), "i");
    searchQuery.$or = [
      { editId: searchRegex },
      { clientName: searchRegex },
      { serviceType: searchRegex },
      { editorName: searchRegex },
    ];
  }

  // Exclude already-linked projects
  const linkedIds = profile.previousProjects.map((pid) => pid.toString());

  const projects = await EditProject.find(searchQuery)
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const results = projects.map((p) => ({
    id: p._id,
    editId: p.editId,
    clientName: p.clientName || "",
    serviceType: p.serviceType || "Video Edit",
    assignedEditor: p.editorName || "Unassigned",
    status: p.status || "In Progress",
    createdAt: p.createdAt,
    alreadyLinked: linkedIds.includes(p._id.toString()),
  }));

  return res.status(200).json(
    new ApiResponse(200, { projects: results }, "Projects search results")
  );
});

// ─── Public Onboarding Endpoints ──────────────────────────────────────────────────

import jwt from "jsonwebtoken";

export const generateOnboardingLink = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const profile = await ClientProfile.findById(id);
  if (!profile) throw new ApiError(404, "Client profile not found");

  // Generate a token valid for 7 days
  const token = jwt.sign(
    { clientId: profile._id, purpose: 'client_onboarding' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  return res.status(200).json(
    new ApiResponse(200, { token }, "Onboarding link generated successfully")
  );
});

export const sendOnboardingLinkViaWebhook = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const profile = await ClientProfile.findById(id);
  if (!profile) throw new ApiError(404, "Client profile not found");

  if (!profile.email) {
    throw new ApiError(400, "Client profile does not have an email address to send to.");
  }

  // Generate a token valid for 7 days
  const token = jwt.sign(
    { clientId: profile._id, purpose: 'client_onboarding' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const onboardingLink = `${frontendUrl}/onboarding/client-profile?token=${token}`;
  
  // Use env var if available, otherwise default to the standard Hogwarts Studios n8n webhook URL
  const webhookUrl = process.env.N8N_ONBOARDING_WEBHOOK_URL || 'https://n8n.hogwartsstudios.com/webhook/send-onboarding-email';

  try {
    const payload = {
      client_name: profile.name,
      client_email: profile.email,
      onboarding_link: onboardingLink,
      client_id: profile._id.toString(),
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("n8n webhook responded with error status:", response.status);
    }
  } catch (webhookError) {
    console.error("Failed to trigger n8n onboarding webhook:", webhookError);
    // We log the error but still return success to the frontend
  }

  return res.status(200).json(
    new ApiResponse(200, null, "Onboarding link sent to client successfully")
  );
});

export const getPublicProfile = asyncHandler(async (req, res) => {
  // Extract ID from the publicClient object attached by verifyPublicClientToken middleware
  const clientId = req.publicClient.id;
  const profile = await ClientProfile.findById(clientId).lean();
  
  if (!profile) throw new ApiError(404, "Client profile not found");

  // Strip internal fields that the client shouldn't see
  const { internalNotes, clientStatus, editorPreferences, previousProjects, ...publicData } = profile;

  return res.status(200).json(
    new ApiResponse(200, { profile: publicData }, "Public profile fetched successfully")
  );
});

export const updatePublicProfile = asyncHandler(async (req, res) => {
  const clientId = req.publicClient.id;
  
  // Only allow updating preference fields
  const allowedFields = [
    "preferredEditingStyle",
    "preferredLanguage",
    "brandingGuidelines",
    "colorPreferences",
    "fontPreferences",
    "musicPreferences",
    "subtitlePreferences",
    "deliveryFormat",
    "revisionExpectations",
    "turnaroundPreference",
    "additionalPreferences",
  ];
  
  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const profile = await ClientProfile.findByIdAndUpdate(
    clientId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!profile) throw new ApiError(404, "Client profile not found");

  return res.status(200).json(
    new ApiResponse(200, { profile }, "Profile updated successfully")
  );
});
