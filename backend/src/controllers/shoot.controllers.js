import { Shoot } from "../models/shoot.models.js";
import { Client } from "../models/client.models.js";
import { Payment } from "../models/payment.models.js";
import { UpsellCrossSell } from "../models/upsellCrossSell.models.js";
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

const getShootById = asyncHandler(async (req, res) => {
  const { shootId } = req.params;
  const shoot = await Shoot.findOne({ shootId });
  if (!shoot) throw new ApiError(404, 'Shoot not found');
  return res.status(200).json(new ApiResponse(200, { shoot }, 'Shoot fetched'));
});

const getShoots = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.leadId)    filter.leadId    = req.query.leadId;
    if (req.query.shootId)   filter.shootId   = req.query.shootId;
    if (req.query.shootDate) filter.shootDate = req.query.shootDate;

    let shoots = await Shoot.find(filter).sort({ createdAt: -1 });

    const user = req.user;
    if (user && user.role === 'shoot') {
        const uemail = user.email?.trim().toLowerCase();
        const uname = user.name?.trim().toLowerCase();
        
        shoots = shoots.filter(shoot => {
            const memberEmail = (shoot.shootMemberEmail || '').trim().toLowerCase();
            const memberName = (shoot.shootMemberName || '').trim().toLowerCase();
            const assignedTo = (shoot.assignedTo || '').trim().toLowerCase();
            
            return memberEmail === uemail || memberName === uname || assignedTo === uname || assignedTo === uemail;
        });
    } else if (user && user.role === 'sales') {
        const uname = user.name?.trim().toLowerCase();
        const uemail = user.email?.trim().toLowerCase();
        const uusername = user.username?.trim().toLowerCase();
        
        const allowedLeads = await Client.find({});
        const myLeadIds = new Set(allowedLeads.filter(lead => {
            const assigned = (lead.assignedTo || '').trim().toLowerCase();
            return assigned === uname || assigned === uemail || assigned === uusername;
        }).map(l => l.leadId));
        
        shoots = shoots.filter(shoot => myLeadIds.has(shoot.leadId));
    } else if (user && user.role === 'admin' && req.query.managerView !== 'true') {
        const uname = user.name?.trim().toLowerCase();
        const uemail = user.email?.trim().toLowerCase();
        const uusername = user.username?.trim().toLowerCase();
        
        const allowedLeads = await Client.find({});
        const myLeadIds = new Set(allowedLeads.filter(lead => {
            const assigned = (lead.assignedTo || '').trim().toLowerCase();
            return assigned === uname || assigned === uemail || assigned === uusername;
        }).map(l => l.leadId));
        
        shoots = shoots.filter(shoot => myLeadIds.has(shoot.leadId));
    }

    const formatted = shoots.map(s => {
        const obj = s.toObject ? s.toObject() : s;
        obj.id = s._id ? s._id.toString() : obj._id;
        if (obj.clientEmailId && !obj.emailId) {
            obj.emailId = obj.clientEmailId;
        }
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
        clientEmailId: body.clientEmailId || body.emailId || body.email_id || "",
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

    if (body.upsellCrossSellId && body.upsellCrossSellId.trim() !== "") {
        // Update upsell status instead of main client lead
        const upsell = await UpsellCrossSell.findById(body.upsellCrossSellId);
        if (upsell && ["initiated", "proposal_sent", "payment_sent", "payment_done"].includes(upsell.status)) {
            upsell.status = "shoot_scheduled";
            await upsell.save();
        }
    } else {
        // Update main client status to Shoot Scheduled
        await Client.findOneAndUpdate(
            { leadId: body.leadId },
            { $set: { status: "Shoot Scheduled" } }
        );
    }

    return res.status(201).json(new ApiResponse(201, { shoot }, "Shoot scheduled successfully"));
});

const updateShoot = asyncHandler(async (req, res) => {
    const { shootId } = req.params;
    const updates = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(updates, "driveLinkUploaded")) {
        updates.driveLinkUploaded = parseBoolean(updates.driveLinkUploaded);
    }

    // Map verified_by from n8n to addonVerifiedBy to ensure the Shoot schema correctly catches it
    if (updates.verified_by && !updates.addonVerifiedBy) {
        updates.addonVerifiedBy = updates.verified_by;
        updates.addonVerifiedAt = updates.verified_at || new Date().toISOString();
        updates.addonPaymentStatus = "Verified";
    }

    // Intercept Addon verification
    let existingShoot = null;
    const isVerifyingAddon = updates.addonVerifiedBy || (updates.addonPaymentStatus && updates.addonPaymentStatus.toLowerCase() === "verified");
    if (isVerifyingAddon) {
        existingShoot = await Shoot.findOne({ shootId });
    }

    const updated = await Shoot.findOneAndUpdate(
        { shootId },
        { $set: updates },
        { new: true }
    );

    if (!updated) {
        throw new ApiError(404, "Shoot not found");
    }

    // Automatically log Addon payment as a MongoDB Payment document
    const wasAlreadyVerified = existingShoot && (existingShoot.addonVerifiedBy || (existingShoot.addonPaymentStatus && existingShoot.addonPaymentStatus.toLowerCase() === "verified"));
    if (isVerifyingAddon && existingShoot && !wasAlreadyVerified) {
        const paymentAmount = Number(updated.additionalCost || 0);
        
        // Calculate amountPaidSoFar by summing up existing payments
        const previousPayments = await Payment.find({ leadId: updated.leadId });
        const previousAmount = previousPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        await Payment.create({
            paymentId: `PAY_${Date.now()}_ADDON`,
            leadId: updated.leadId,
            clientName: updated.clientName,
            amount: paymentAmount,
            paymentLinkSent: false,
            paymentStatus: "Payment Verified",
            verifiedBy: updates.addonVerifiedBy,
            verifiedAt: updates.addonVerifiedAt || new Date().toISOString(),
            totalCost: paymentAmount, // As requested in plan, logging it standalone
            remainingAmount: 0,
            paymentCompleted: true,
            installmentNumber: "Addon",
            installmentLabel: "Addon Payment",
            paymentMode: "Online",
            screenshotUrl: updated.addonScreenshot || "",
            utrNumber: updated.addonUtr || "Not provided",
            amountPaidSoFar: previousAmount + paymentAmount
        });
    }

    return res.status(200).json(new ApiResponse(200, { shoot: updated }, "Shoot updated successfully"));
});

export { getShoots, getShootById, createShoot, updateShoot };
