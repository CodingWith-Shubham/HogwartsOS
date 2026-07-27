import { Payment } from "../models/payment.models.js";
import { Client } from "../models/client.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const getPayments = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.leadId) filter.leadId = req.query.leadId;
    if (req.query.paymentId) filter.paymentId = req.query.paymentId;
    
    const payments = await Payment.find(filter).sort({ createdAt: -1 });
    const formatted = payments.map(p => {
        const obj = p.toObject();
        obj.id = p._id.toString();
        return obj;
    });
    return res.status(200).json(new ApiResponse(200, { payments: formatted }, "Payments retrieved successfully"));
});

const createPayment = asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.leadId || !body.amount) {
        throw new ApiError(400, "Lead ID and amount are required");
    }

    const paymentId = body.paymentId || `PAY_${Date.now()}`;
    const payment = await Payment.create({
        paymentId,
        leadId: body.leadId,
        clientName: body.clientName || "",
        amount: Number(body.amount),
        paymentLinkSent: Boolean(body.paymentLinkSent),
        paymentLinkSentAt: body.paymentLinkSentAt || new Date().toISOString(),
        screenshotUrl: body.screenshotUrl || "",
        utrNumber: body.utrNumber || "Not provided",
        // Default to "Link Sent" — do NOT default to "Payment Verified".
        // Verification only happens when the salesperson explicitly verifies via the dashboard.
        paymentStatus: body.paymentStatus || "Link Sent",
        verifiedBy: body.verifiedBy || "",
        // Only set verifiedAt when an actual verification status is provided
        verifiedAt: body.verifiedBy ? (body.verifiedAt || new Date().toISOString()) : "",
        totalCost: Number(body.totalCost || 0),
        remainingAmount: Number(body.remainingAmount || 0),
        paymentCompleted: Boolean(body.paymentCompleted),
        installmentNumber: body.installmentNumber || "1",
        installmentLabel: body.installmentLabel || "Advance",
        paymentMode: body.paymentMode || "Online",
        amountPaidSoFar: Number(body.amountPaidSoFar || 0)
    });

    // Only update client status for cash payments (immediately verified) or
    // for payment completion — NOT for online payment link creation.
    // Online payments remain "Payment Link Sent" until screenshot is uploaded.
    if (payment.paymentMode === 'Cash' || payment.paymentCompleted) {
        const status = payment.paymentCompleted ? "Payment Completed" : "Payment Verified";
        await Client.findOneAndUpdate(
            { leadId: body.leadId },
            { $set: { status } }
        );
    }

    return res.status(201).json(new ApiResponse(201, { payment }, "Payment created successfully"));
});

const verifyPayment = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const body = req.body;

    // Build the update object from the request body.
    // This endpoint is called by both:
    //   1. n8n workflow (to save screenshot URL when client uploads proof)
    //   2. Frontend confirm-payment route (to mark as Payment Verified)
    const updateFields = {
        paymentStatus: body.paymentStatus || "Payment Verified",
        verifiedBy: body.verifiedBy || req.user?.name || "System",
        verifiedAt: body.verifiedAt || new Date().toISOString(),
    };

    // Persist screenshot URL if provided (set by n8n when client uploads)
    if (body.screenshotUrl) {
        updateFields.screenshotUrl = body.screenshotUrl;
    }

    // Persist UTR / transaction reference number if provided
    if (body.utrNumber) {
        updateFields.utrNumber = body.utrNumber;
    }

    // Update running payment totals if the n8n confirm workflow provides them
    if (body.amountPaidSoFar !== undefined) {
        updateFields.amountPaidSoFar = Number(body.amountPaidSoFar);
    }
    if (body.remainingAmount !== undefined) {
        updateFields.remainingAmount = Number(body.remainingAmount);
    }
    if (body.paymentCompleted !== undefined) {
        updateFields.paymentCompleted = Boolean(body.paymentCompleted);
    }

    const payment = await Payment.findOneAndUpdate(
        { paymentId },
        { $set: updateFields },
        { new: true }
    );

    if (!payment) {
        throw new ApiError(404, "Payment record not found");
    }

    return res.status(200).json(new ApiResponse(200, { payment }, "Payment updated successfully"));
});

export { getPayments, createPayment, verifyPayment };
