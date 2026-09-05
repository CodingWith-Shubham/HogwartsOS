import { Shoot } from "../models/shoot.models.js";
import { Client } from "../models/client.models.js";
import { Payment } from "../models/payment.models.js";
import { UpsellCrossSell } from "../models/upsellCrossSell.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendPushNotification } from "../services/notification.service.js";
import { User } from "../models/user.models.js";

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
  
  const obj = shoot.toObject();
  if (obj.deliverable_set_index !== undefined) {
      obj.deliverableSetIndex = obj.deliverable_set_index;
  }
  
  return res.status(200).json(new ApiResponse(200, { shoot: obj }, 'Shoot fetched'));
});

const getShoots = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.leadId)    filter.leadId    = req.query.leadId;
    if (req.query.shootId)   filter.shootId   = req.query.shootId;
    if (req.query.shootDate) filter.shootDate = req.query.shootDate;

    let shoots = await Shoot.find(filter).sort({ createdAt: -1 });

    const user = req.user;
    if (user && (user.role === 'super_admin' || user.role === 'admin' || user.role === 'manager')) {
        // Super admins, admins, and managers see all shoots, no filtering required.
    } else if (user && user.role === 'shoot') {
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
    }

    const formatted = shoots.map(s => {
        const obj = s.toObject ? s.toObject() : s;
        obj.id = s._id ? s._id.toString() : obj._id;
        if (obj.clientEmailId && !obj.emailId) {
            obj.emailId = obj.clientEmailId;
        }
        if (obj.deliverable_set_index !== undefined) {
            obj.deliverableSetIndex = obj.deliverable_set_index;
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
    let setName = body.setName || "Default Studio";
    let upsellCrossSellId = String(body.upsellCrossSellId || body.upsell_crosssell_id || "").trim();
    if (setName.includes(" ||| UPSELL:")) {
        const parts = setName.split(" ||| UPSELL:");
        setName = parts[0].trim();
        upsellCrossSellId = parts[1].trim();
    }
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
        setName,
        recordTime: body.recordTime || body.record_time || "",
        studioTime: body.studioTime || body.studio_time || "",
        deliverableSetIndex: body.deliverableSetIndex ?? body.deliverable_set_index ?? 0,
        // Tag the shoot with the upsell entry ID so it is isolated from the original lead's shoots
        upsellCrossSellId,
        // Booking mode: 'confirmed' (default, from n8n schedule-shoot webhook) or
        // 'tentative' (from the new Tentative Booking button in the Sales dashboard).
        // Confirmed shoots trigger an n8n calendar invite immediately.
        // Tentative shoots are held without a calendar invite; the payment verifier
        // resolves conflicts and triggers n8n for the winning shoot only.
        bookingStatus: body.bookingStatus || 'confirmed',
        bookingStatusNote: body.bookingStatusNote || ''
    });

    if (upsellCrossSellId) {
        // Update upsell status instead of main client lead
        const upsell = await UpsellCrossSell.findById(upsellCrossSellId);
        if (upsell && ["initiated", "proposal_sent", "payment_sent", "payment_done"].includes(upsell.status)) {
            upsell.status = "shoot_scheduled";
            await upsell.save();
        }
    } else if (!upsellCrossSellId) {
        // Update main client status to Shoot Scheduled
        await Client.findOneAndUpdate(
            { leadId: body.leadId },
            { $set: { status: "Shoot Scheduled" } }
        );
    }

    // Notifications
    const notifyUserIds = [];
    if (shoot.shootMemberEmail) {
        const shootUser = await User.findOne({ email: new RegExp(`^${shoot.shootMemberEmail}$`, 'i') });
        if (shootUser) notifyUserIds.push(shootUser._id);
    }
    
    // Fetch client to get assigned sales rep
    const clientForShoot = await Client.findOne({ leadId: body.leadId });
    if (clientForShoot && clientForShoot.assignedTo) {
        const salesUser = await User.findOne({
            $or: [
                { name: new RegExp(`^${clientForShoot.assignedTo}$`, 'i') },
                { email: new RegExp(`^${clientForShoot.assignedTo}$`, 'i') },
                { username: new RegExp(`^${clientForShoot.assignedTo}$`, 'i') }
            ]
        });
        if (salesUser) notifyUserIds.push(salesUser._id);
    }

    sendPushNotification({ userIds: notifyUserIds }, {
        title: 'Shoot Scheduled',
        message: `Shoot for ${shoot.clientName} scheduled on ${shoot.shootDate}.`,
        href: '/shoot'
    }).catch(console.error);

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

    // Notifications
    if (updates.driveLinkUploaded === true && (!existingShoot || existingShoot.driveLinkUploaded !== true)) {
        // Shoot footage uploaded, pending assigning the editor
        const notifyUserIds = [];
        const clientForFootage = await Client.findOne({ leadId: updated.leadId });
        if (clientForFootage && clientForFootage.assignedTo) {
            const salesUser = await User.findOne({
                $or: [
                    { name: new RegExp(`^${clientForFootage.assignedTo}$`, 'i') },
                    { email: new RegExp(`^${clientForFootage.assignedTo}$`, 'i') },
                    { username: new RegExp(`^${clientForFootage.assignedTo}$`, 'i') }
                ]
            });
            if (salesUser) notifyUserIds.push(salesUser._id);
        }

        sendPushNotification({ userIds: notifyUserIds, roles: ['manager', 'admin', 'super_admin'] }, {
            title: 'Shoot footage uploaded',
            message: `Footage for ${updated.clientName} has been uploaded. Please assign an editor.`,
            href: '/manager'
        }).catch(console.error);
    }

    if (updates.addonScreenshot && (!existingShoot || existingShoot.addonScreenshot !== updates.addonScreenshot)) {
        // Addon payment unverified (screenshot uploaded)
        const notifyUserIds = [];
        const clientForAddon = await Client.findOne({ leadId: updated.leadId });
        if (clientForAddon && clientForAddon.assignedTo) {
            const salesUser = await User.findOne({
                $or: [
                    { name: new RegExp(`^${clientForAddon.assignedTo}$`, 'i') },
                    { email: new RegExp(`^${clientForAddon.assignedTo}$`, 'i') },
                    { username: new RegExp(`^${clientForAddon.assignedTo}$`, 'i') }
                ]
            });
            if (salesUser) notifyUserIds.push(salesUser._id);
        }
        sendPushNotification({ userIds: notifyUserIds, roles: ['admin', 'super_admin'] }, {
            title: 'Shoot Addon Payment needs verification',
            message: `An addon payment screenshot for ${updated.clientName} has been uploaded.`,
            href: '/manager'
        }).catch(console.error);
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
            amountPaidSoFar: previousAmount + paymentAmount,
            // Tag the addon payment with the upsell entry ID so it doesn't
            // pollute the original client's payment history / remaining balance.
            upsellCrossSellId: updated.upsellCrossSellId || ""
        });
    }

    return res.status(200).json(new ApiResponse(200, { shoot: updated }, "Shoot updated successfully"));
});

// ── Reschedule support ─────────────────────────────────────────────────────
// Releases the existing shoot so it can be rescheduled: marks it cancelled with
// a "Rescheduled" note and frees its deliverableSetIndex. The frontend calls
// this FIRST, then fires the same n8n schedule-shoot webhook (unchanged) with
// the new date/time so n8n creates the updated shoot + sends the calendar
// invite exactly like a normal schedule. If the webhook call fails, the
// frontend restores this shoot via the regular PUT /shoots/:shootId update.
const rescheduleShoot = asyncHandler(async (req, res) => {
    const { shootId } = req.params;

    const shoot = await Shoot.findOne({ shootId });
    if (!shoot) throw new ApiError(404, "Shoot not found");

    if (shoot.bookingStatus === 'conflict') {
        throw new ApiError(400, "This shoot is already marked as conflicted — it cannot be rescheduled.");
    }
    if (shoot.bookingStatus === 'cancelled') {
        throw new ApiError(400, "This shoot has already been cancelled.");
    }

    const { newDate, newStartTime, newEndTime } = req.body || {};
    const rescheduledBy = req.user?.name || req.user?.email || 'Staff';
    const target = newDate
        ? ` → ${newDate}${newStartTime ? ` ${newStartTime}` : ''}${newEndTime ? `-${newEndTime}` : ''}`
        : '';

    await Shoot.findOneAndUpdate(
        { shootId },
        {
            $set: {
                bookingStatus: 'cancelled',
                bookingStatusNote: `Rescheduled by ${rescheduledBy}${target}`,
                deliverableSetIndex: -1,
                deliverable_set_index: -1
            }
        }
    );

    return res.status(200).json(new ApiResponse(200, {}, "Shoot released for rescheduling"));
});

const deleteShoot = asyncHandler(async (req, res) => {
    const { shootId } = req.params;

    const shoot = await Shoot.findOne({ shootId });
    if (!shoot) throw new ApiError(404, "Shoot not found");

    // Only tentative or confirmed shoots may be cancelled; already-resolved or
    // already-cancelled shoots are read-only from this endpoint.
    if (shoot.bookingStatus === 'conflict') {
        throw new ApiError(400, "This shoot is already marked as conflicted — no cancellation needed.");
    }
    if (shoot.bookingStatus === 'cancelled') {
        throw new ApiError(400, "This shoot has already been cancelled.");
    }

    const cancelledBy = req.user?.name || req.user?.email || 'Staff';
    await Shoot.findOneAndUpdate(
        { shootId },
        {
            $set: {
                bookingStatus: 'cancelled',
                bookingStatusNote: `Manually cancelled by ${cancelledBy}`,
                deliverableSetIndex: -1
            }
        }
    );

    return res.status(200).json(new ApiResponse(200, {}, "Shoot cancelled successfully"));
});

/**
 * resolveShootConflicts
 * Called after a payment is verified for a lead. Finds the lead's tentative
 * shoot (if any), marks it 'confirmed', then marks all other tentative shoots
 * that share the same date + room + overlapping time window as 'conflict'.
 *
 * This is NOT an HTTP handler — it is called internally by payment.controllers.
 * It does NOT throw; errors are logged and swallowed so the payment flow is
 * never blocked.
 *
 * @param {string} leadId
 * @param {string} [upsellCrossSellId] - Set when the payment belongs to an upsell entry.
 */
const resolveShootConflicts = async (leadId, upsellCrossSellId = "") => {
    try {
        // Find the winner: the active shoot belonging to this lead/upsell.
        const winnerFilter = { leadId, bookingStatus: { $in: ['tentative', 'confirmed'] } };
        if (upsellCrossSellId) {
            winnerFilter.upsellCrossSellId = upsellCrossSellId;
        } else {
            // Exclude upsell shoots from the main-lead winner search
            winnerFilter.$or = [
                { upsellCrossSellId: "" },
                { upsellCrossSellId: { $exists: false } }
            ];
        }

        const winner = await Shoot.findOne(winnerFilter);
        if (!winner) return; // No active shoot for this lead — nothing to resolve.

        // Confirm the winner.
        if (winner.bookingStatus !== 'confirmed') {
            winner.bookingStatus = 'confirmed';
            winner.bookingStatusNote = 'Confirmed — payment received first';
            await winner.save();
        }

        // If the winner has no date/set/time info we cannot run conflict detection.
        if (!winner.shootDate || !winner.setName || !winner.shootStartTime || !winner.shootEndTime) return;

        // Helper: check whether two time windows overlap.
        const toMins = (t) => {
            const [h, m] = (t || '').split(':').map(Number);
            return (h * 60) + (m || 0);
        };
        const overlaps = (s1, e1, s2, e2) => toMins(s1) < toMins(e2) && toMins(s2) < toMins(e1);

        // Find all other active shoots on the same date that could conflict.
        const candidates = await Shoot.find({
            shootDate: winner.shootDate,
            bookingStatus: { $in: ['tentative', 'confirmed'] },
            _id: { $ne: winner._id }
        });

        // Filter out candidates that have ALREADY PAID
        const unpaidCandidates = [];
        for (const c of candidates) {
            let hasPaid = false;
            if (c.upsellCrossSellId) {
                const upsell = await UpsellCrossSell.findById(c.upsellCrossSellId);
                if (upsell && ['payment_done', 'shoot_scheduled', 'shoot_done'].includes(upsell.status)) {
                    hasPaid = true;
                }
            } else {
                const client = await Client.findOne({ leadId: c.leadId });
                if (client && ['Payment Verified', 'Assign Editor'].includes(client.status)) {
                    hasPaid = true;
                }
            }
            if (!hasPaid) {
                unpaidCandidates.push(c);
            }
        }

        const conflicted = unpaidCandidates.filter((c) => {
            // Room/set matching — 'Entire Studio' conflicts with everything.
            const setConflicts =
                c.setName === winner.setName ||
                c.setName === 'Entire Studio' ||
                winner.setName === 'Entire Studio';
            if (!setConflicts) return false;
            return overlaps(
                winner.shootStartTime, winner.shootEndTime,
                c.shootStartTime, c.shootEndTime
            );
        });

        if (conflicted.length > 0) {
            const conflictedIds = conflicted.map((c) => c._id);
            await Shoot.updateMany(
                { _id: { $in: conflictedIds } },
                {
                    $set: {
                        bookingStatus: 'conflict',
                        bookingStatusNote: `Slot taken — ${winner.clientName || 'another client'} confirmed payment first`,
                        deliverableSetIndex: -1
                    }
                }
            );
        }
    } catch (err) {
        // Non-fatal: log and continue. The payment flow must not be blocked.
        console.error('[resolveShootConflicts] Error:', err);
    }
};

export { getShoots, getShootById, createShoot, updateShoot, deleteShoot, rescheduleShoot, resolveShootConflicts };
