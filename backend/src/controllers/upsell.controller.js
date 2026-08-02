import { Client } from "../models/client.models.js";
import { Project } from "../models/project.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

export const createUpsellLead = asyncHandler(async (req, res) => {
    const { existingClientId, assignedTo, cost, serviceType, notes } = req.body;

    if (!existingClientId) {
        throw new ApiError(400, "existingClientId is required");
    }

    const existingClient = await Client.findOne({ leadId: existingClientId });
    if (!existingClient) {
        throw new ApiError(404, "Existing client not found");
    }

    const leadId = `HL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const upsellLead = await Client.create({
        leadId,
        name: existingClient.name,
        phoneNumber: existingClient.phoneNumber,
        clientEmail: existingClient.clientEmail,
        date: new Date().toLocaleDateString('en-GB'),
        adRefCode: existingClient.adRefCode || "manual",
        source: "Upsell",
        assignedTo: assignedTo || req.user?.name || "",
        reachoutDone: "Yes",
        servicePitched: serviceType || "Podcast",
        cost: Number(cost || 0),
        status: "New Lead",
        leadType: "upsell",
        proposalSent: false,
        proposalAccepted: false,
        proposalSentAt: new Date().toISOString()
    });

    return res.status(201).json(new ApiResponse(201, { lead: upsellLead }, "Upsell lead created successfully"));
});

export const getUpsellMetrics = asyncHandler(async (req, res) => {
    // Analytics logic for upsells vs leads
    // Use MongoDB aggregation
    const matchStage = { $match: { } };

    const stats = await Client.aggregate([
        {
            $group: {
                _id: "$leadType",
                count: { $sum: 1 },
                revenue: { $sum: "$cost" }
            }
        }
    ]);

    const totalLeadsObj = stats.find(s => s._id === 'lead') || { count: 0, revenue: 0 };
    const totalUpsellsObj = stats.find(s => s._id === 'upsell') || { count: 0, revenue: 0 };

    const totalLeads = totalLeadsObj.count + totalUpsellsObj.count;
    const totalUpsells = totalUpsellsObj.count;
    const upsellPercentage = totalLeads > 0 ? ((totalUpsells / totalLeads) * 100).toFixed(1) : 0;
    
    // Simplification for conversion: any accepted proposal
    const acceptedStats = await Client.aggregate([
        { $match: { proposalAccepted: true, leadType: 'upsell' } },
        { $count: "accepted" }
    ]);
    const acceptedUpsells = acceptedStats[0]?.accepted || 0;
    const upsellConversionRate = totalUpsells > 0 ? ((acceptedUpsells / totalUpsells) * 100).toFixed(1) : 0;

    const revenueFromLeads = totalLeadsObj.revenue;
    const revenueFromUpsells = totalUpsellsObj.revenue;
    const totalRevenue = revenueFromLeads + revenueFromUpsells;
    const upsellRevenuePercentage = totalRevenue > 0 ? ((revenueFromUpsells / totalRevenue) * 100).toFixed(1) : 0;

    // Monthly breakdown
    const monthlyBreakdownRaw = await Client.aggregate([
        {
            $addFields: {
                parsedDate: {
                    $dateFromString: {
                        dateString: "$date",
                        format: "%d/%m/%Y",
                        onError: "$createdAt",
                        onNull: "$createdAt"
                    }
                }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: "$parsedDate" },
                    month: { $month: "$parsedDate" },
                    type: "$leadType"
                },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { "_id.year": 1, "_id.month": 1 }
        }
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const breakdownMap = new Map();

    monthlyBreakdownRaw.forEach(item => {
        const monthLabel = `${monthNames[item._id.month - 1]} ${item._id.year}`;
        if (!breakdownMap.has(monthLabel)) {
            breakdownMap.set(monthLabel, { month: monthLabel, leads: 0, upsells: 0 });
        }
        if (item._id.type === 'upsell') {
            breakdownMap.get(monthLabel).upsells = item.count;
        } else {
            breakdownMap.get(monthLabel).leads += item.count; // fallback 'lead' or undefined
        }
    });

    const monthlyBreakdown = Array.from(breakdownMap.values());

    return res.status(200).json(new ApiResponse(200, {
        totalLeads,
        totalUpsells,
        upsellPercentage: Number(upsellPercentage),
        upsellConversionRate: Number(upsellConversionRate),
        revenueFromLeads,
        revenueFromUpsells,
        upsellRevenuePercentage: Number(upsellRevenuePercentage),
        topUpsellClients: [], // Placeholder
        monthlyBreakdown
    }, "Upsell metrics retrieved"));
});
