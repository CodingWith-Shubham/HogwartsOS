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
        paymentStatus: body.paymentStatus || "Payment Verified",
        verifiedBy: body.verifiedBy || req.user?.name || "",
        verifiedAt: new Date().toISOString(),
        totalCost: Number(body.totalCost || 0),
        remainingAmount: Number(body.remainingAmount || 0),
        paymentCompleted: Boolean(body.paymentCompleted),
        installmentNumber: body.installmentNumber || "1",
        installmentLabel: body.installmentLabel || "Advance",
        paymentMode: body.paymentMode || "Online",
        amountPaidSoFar: Number(body.amountPaidSoFar || body.amount)
    });

    // Update client payment status
    const status = payment.paymentCompleted ? "Payment Completed" : "Payment Verified";
    await Client.findOneAndUpdate(
        { leadId: body.leadId },
        { $set: { status } }
    );

    return res.status(201).json(new ApiResponse(201, { payment }, "Payment created successfully"));
});

const verifyPayment = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const payment = await Payment.findOneAndUpdate(
        { paymentId },
        {
            $set: {
                paymentStatus: "Payment Verified",
                verifiedBy: req.user?.name || "Manager",
                verifiedAt: new Date().toISOString()
            }
        },
        { new: true }
    );

    if (!payment) {
        throw new ApiError(404, "Payment record not found");
    }

    return res.status(200).json(new ApiResponse(200, { payment }, "Payment verified successfully"));
});

export { getPayments, createPayment, verifyPayment };
