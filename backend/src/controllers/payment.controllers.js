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

    // Determine the status to set
    let newPaymentStatus = body.paymentStatus;
    
    // Safety override: if n8n is sending a screenshot upload, force it to 'Screenshot Received' 
    // to prevent accidental auto-verification if the n8n workflow is misconfigured to send 'Payment Verified'
    if (req.user?._id === 'n8n-system') {
        if (body.screenshotUrl) {
            newPaymentStatus = "Screenshot Received";
            body.verifiedBy = ""; // Clear out any accidental verifier name
        }
        
        // Anti-Gmail-Prefetch logic removed by user request. 
        // Be warned: Gmail may auto-click the verification link when it scans emails!
        // if (newPaymentStatus === "Payment Verified") {
        //     const existing = await Payment.findOne({ paymentId });
        //     return res.status(200).json(new ApiResponse(200, { payment: existing }, "Ignored n8n auto-verify to prevent Gmail prefetch bug"));
        // }
    } else if (!newPaymentStatus) {
        if (body.screenshotUrl) {
            newPaymentStatus = "Screenshot Received";
        } else {
            newPaymentStatus = "Payment Verified"; // fallback for legacy behavior
        }
    }

    const updateFields = {
        paymentStatus: newPaymentStatus,
        // Only set verified fields if it's actually being verified, not just receiving a screenshot
        ...(newPaymentStatus === "Payment Verified" && {
            verifiedBy: body.verifiedBy || req.user?.name || "System",
            verifiedAt: body.verifiedAt || new Date().toISOString(),
        })
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

    // Also update the Client status so the pipeline reflects the current state
    let clientStatus;
    if (newPaymentStatus === "Screenshot Received" || newPaymentStatus === "Screenshot Uploaded") {
        clientStatus = "Payment Under Review";
    } else if (newPaymentStatus === "Payment Verified") {
        clientStatus = payment.paymentCompleted ? "Payment Completed" : "Payment Verified";
    } else if (body.paymentCompleted || payment.paymentCompleted) {
        clientStatus = "Payment Completed";
    }

    if (clientStatus) {
        await Client.findOneAndUpdate(
            { leadId: payment.leadId },
            { $set: { status: clientStatus } }
        );
    }

    return res.status(200).json(new ApiResponse(200, { payment }, "Payment updated successfully"));
});

export { getPayments, createPayment, verifyPayment };
