import { Client } from "../models/client.models.js";
import { Shoot } from "../models/shoot.models.js";
import { EditProject, EditingTask } from "../models/editing.models.js";
import { Payment } from "../models/payment.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const getRealtimeData = asyncHandler(async (req, res) => {
    const totalLeads = await Client.countDocuments();
    const scheduledShoots = await Shoot.countDocuments({ shootDate: { $ne: "" } });
    const activeEdits = await EditingTask.countDocuments({ status: { $ne: "Delivered" } });

    const payments = await Payment.find({});
    let totalRevenue = 0;
    let pendingPayments = 0;

    payments.forEach(p => {
        totalRevenue += Number(p.amount || 0);
        pendingPayments += Number(p.remainingAmount || 0);
    });

    return res.status(200).json(new ApiResponse(200, {
        totalLeads,
        scheduledShoots,
        activeEdits,
        totalRevenue,
        pendingPayments,
        lastUpdated: new Date().toISOString()
    }, "Realtime data fetched successfully"));
});

export { getRealtimeData };
