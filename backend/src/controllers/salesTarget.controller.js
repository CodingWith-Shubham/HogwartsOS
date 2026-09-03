import { SalesTarget } from "../models/salesTarget.model.js";
import { Payment } from "../models/payment.models.js";
import { Client } from "../models/client.models.js";
import { UpsellCrossSell } from "../models/upsellCrossSell.models.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

// Helper to calculate start and end dates for a YYYY-MM period
const getPeriodDateRange = (period) => {
    const [year, month] = period.split('-');
    const startDate = new Date(year, parseInt(month) - 1, 1);
    const endDate = new Date(year, parseInt(month), 0, 23, 59, 59, 999);
    return { startDate, endDate };
};

export const upsertSalesTarget = asyncHandler(async (req, res) => {
    const { salesPersonId, salesPersonName, period, targetAmount, targetType } = req.body;

    if (!salesPersonId || !period || targetAmount === undefined) {
        throw new ApiError(400, "salesPersonId, period, and targetAmount are required");
    }

    const target = await SalesTarget.findOneAndUpdate(
        { salesPersonId, period },
        {
            salesPersonId,
            salesPersonName: salesPersonName || salesPersonId,
            period,
            targetAmount: Number(targetAmount),
            targetType: targetType || "revenue",
            createdBy: req.user?.name || "System"
        },
        { new: true, upsert: true }
    );

    res.status(200).json({
        success: true,
        target
    });
});

export const getSalesTargetsByPeriod = asyncHandler(async (req, res) => {
    const { period } = req.query;

    if (!period) {
        throw new ApiError(400, "period query parameter is required (YYYY-MM)");
    }

    const { startDate, endDate } = getPeriodDateRange(period);

    // Get all targets for the period
    const targets = await SalesTarget.find({ period }).lean();

    // Fetch all verified payments
    const allVerifiedPayments = await Payment.find({
        $or: [
            { paymentStatus: { $regex: /verified/i } },
            { paymentStatus: { $regex: /confirmed/i } },
            { paymentStatus: { $regex: /cash received/i } }
        ]
    }).lean();

    const clients = await Client.find({}, 'leadId assignedTo').lean();
    const clientMap = clients.reduce((acc, c) => {
        if (c.leadId) acc[c.leadId] = c.assignedTo;
        return acc;
    }, {});

    const upsells = await UpsellCrossSell.find({}, '_id assignedTo').lean();
    const upsellMap = upsells.reduce((acc, u) => {
        acc[u._id.toString()] = u.assignedTo;
        return acc;
    }, {});

    const achievementMap = {};

    allVerifiedPayments.forEach(p => {
        let paymentDate = null;
        if (p.verifiedAt) paymentDate = new Date(p.verifiedAt);
        else if (p.createdAt) paymentDate = new Date(p.createdAt);
        else if (p.paymentLinkSentAt) paymentDate = new Date(p.paymentLinkSentAt);

        if (paymentDate && !isNaN(paymentDate.getTime()) && paymentDate >= startDate && paymentDate <= endDate) {
            let assignedTo = null;
            if (p.upsellCrossSellId && upsellMap[p.upsellCrossSellId]) {
                assignedTo = upsellMap[p.upsellCrossSellId];
            } else if (p.leadId && clientMap[p.leadId]) {
                assignedTo = clientMap[p.leadId];
            }

            if (assignedTo) {
                achievementMap[assignedTo] = (achievementMap[assignedTo] || 0) + Number(p.amount || 0);
            }
        }
    });

    const enrichedTargets = targets.map(target => {
        const achieved = achievementMap[target.salesPersonId] || 0;
        const remaining = Math.max(0, target.targetAmount - achieved);
        const achievementPercentage = target.targetAmount > 0 ? (achieved / target.targetAmount) * 100 : 0;
        
        return {
            ...target,
            achieved,
            remaining,
            achievementPercentage
        };
    });

    res.status(200).json({
        success: true,
        targets: enrichedTargets
    });
});

export const getSalesTargetHistory = asyncHandler(async (req, res) => {
    const { salesPersonId } = req.params;

    const targets = await SalesTarget.find({ salesPersonId }).sort({ period: -1 }).lean();

    res.status(200).json({
        success: true,
        targets
    });
});

export const deleteSalesTarget = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const target = await SalesTarget.findByIdAndDelete(id);

    if (!target) {
        throw new ApiError(404, "Target not found");
    }

    res.status(200).json({
        success: true,
        message: "Target deleted successfully"
    });
});
