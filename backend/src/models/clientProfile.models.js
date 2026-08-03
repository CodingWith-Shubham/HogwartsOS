import mongoose, { Schema } from "mongoose";

const clientProfileSchema = new Schema(
  {
    // 1. Basic Information
    name: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "",
    },
    timezone: {
      type: String,
      trim: true,
      default: "",
    },
    preferredCommunication: {
      type: String,
      trim: true,
      default: "",
    },
    alternateContact: {
      type: String,
      trim: true,
      default: "",
    },

    // 2. Sales / Manager Details
    budgetRange: {
      type: String,
      default: "",
    },
    paymentMethod: {
      type: String,
      default: "",
    },
    leadSource: {
      type: String,
      default: "",
    },
    businessType: {
      type: String,
      default: "",
    },
    internalNotes: {
      type: String,
      default: "",
    },
    specialInstructions: {
      type: String,
      default: "",
    },
    clientStatus: {
      type: String,
      enum: ["Active", "Inactive", "VIP"],
      default: "Active",
    },

    // 3. Client Preferences
    preferredEditingStyle: {
      type: String,
      default: "",
    },
    preferredLanguage: {
      type: String,
      default: "",
    },
    brandingGuidelines: {
      type: String,
      default: "",
    },
    colorPreferences: {
      type: String,
      default: "",
    },
    fontPreferences: {
      type: String,
      default: "",
    },
    musicPreferences: {
      type: String,
      default: "",
    },
    subtitlePreferences: {
      type: String,
      default: "",
    },
    deliveryFormat: {
      type: String,
      default: "",
    },
    revisionExpectations: {
      type: String,
      default: "",
    },
    turnaroundPreference: {
      type: String,
      default: "",
    },
    additionalPreferences: {
      type: String,
      default: "",
    },

    // 4. Editor Preferences
    editorPreferences: {
      editingStyleNotes: { type: String, default: "" },
      transitionPreferences: { type: String, default: "" },
      motionGraphicsPreferences: { type: String, default: "" },
      thumbnailNotes: { type: String, default: "" },
      commonlyUsedAssets: { type: String, default: "" },
      feedbackSummary: { type: String, default: "" },
      audioPreferences: { type: String, default: "" },
      colorGradingNotes: { type: String, default: "" },
      revisionPatterns: { type: String, default: "" },
      technicalNotes: { type: String, default: "" },
      editorObservations: { type: String, default: "" },
      futureRecommendations: { type: String, default: "" },
    },

    // 5. Previous Projects (manually linked)
    previousProjects: [
      {
        type: Schema.Types.ObjectId,
        ref: "EditProject",
      },
    ],

    // 6. Metadata
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Sparse unique indexes — only enforce uniqueness when the field is non-empty
clientProfileSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $gt: "" } } }
);
clientProfileSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $gt: "" } } }
);

export const ClientProfile = mongoose.model("ClientProfile", clientProfileSchema);
export default ClientProfile;
