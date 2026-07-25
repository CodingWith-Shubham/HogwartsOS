import { Shoot } from "../models/shoot.models.js";
import { Client } from "../models/client.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const parseBoolean = (value, defaultValue = false) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
        if (value === 1) return true;
        if (value === 0) return false;
        return defaultValue;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "y"].includes(normalized)) return true;
        if (["false", "0", "no", "n", ""].includes(normalized)) return false;
        return defaultValue;
    }
    if (value == null) return defaultValue;
    return defaultValue;
};

const getShoots = asyncHandler(async (req, res) => {
    const shoots = await Shoot.find({}).sort({ createdAt: -1 });
    const formatted = shoots.map(s => {
        const obj = s.toObject();
        obj.id = s._id.toString();
        return obj;
    });
    return res.status(200).json(new ApiResponse(200, { shoots: formatted }, "Shoots retrieved successfully"));
});

const createShoot = asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.leadId || !body.shootDate) {
        throw new ApiError(400, "Lead ID and shoot date are required");
    }

    const shootId = body.shootId || `SHOOT_${Date.now()}`;
    const shoot = await Shoot.create({
        shootId,
        leadId: body.leadId,
        clientName: body.clientName || "",
        contactNum: body.contactNum || "",
        clientEmailId: body.clientEmailId || "",
        shootDate: body.shootDate,
        shootStartTime: body.shootStartTime || "10:00",
        shootEndTime: body.shootEndTime || "12:00",
        camera: body.camera || "1",
        teleprompter: body.teleprompter || "No",
        totalHours: body.totalHours || "2",
        assignedTo: body.assignedTo || "",
        bts: body.bts || "No",
        shootMemberName: body.shootMemberName || "",
        shootMemberEmail: body.shootMemberEmail || "",
        dataLink: body.dataLink || "",
        driveLinkUploaded: parseBoolean(body.driveLinkUploaded),
        setName: body.setName || "Default Studio"
    });

    // Update client status to Shoot Scheduled
    await Client.findOneAndUpdate(
        { leadId: body.leadId },
        { $set: { status: "Shoot Scheduled" } }
    );

    return res.status(201).json(new ApiResponse(201, { shoot }, "Shoot scheduled successfully"));
});

const updateShoot = asyncHandler(async (req, res) => {
    const { shootId } = req.params;
    const updates = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(updates, "driveLinkUploaded")) {
        updates.driveLinkUploaded = parseBoolean(updates.driveLinkUploaded);
    }

    const updated = await Shoot.findOneAndUpdate(
        { shootId },
        { $set: updates },
        { new: true }
    );

    if (!updated) {
        throw new ApiError(404, "Shoot not found");
    }

    return res.status(200).json(new ApiResponse(200, { shoot: updated }, "Shoot updated successfully"));
});

export { getShoots, createShoot, updateShoot };
