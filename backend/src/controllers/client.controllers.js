import { Client } from "../models/client.models.js";
import { EditProject, EditingTask } from "../models/editing.models.js";
import { Shoot } from "../models/shoot.models.js";
import { Payment } from "../models/payment.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const getClients = asyncHandler(async (req, res) => {
    const user = req.user;
    const leads = await Client.find({}).sort({ createdAt: -1 });

    let filteredLeads = leads;

    if (user && user.role === 'sales') {
        const uname = user.name?.trim().toLowerCase();
        const uemail = user.email?.trim().toLowerCase();
        const uusername = user.username?.trim().toLowerCase();

        filteredLeads = leads.filter(lead => {
            const assigned = (lead.assignedTo || '').trim().toLowerCase();
            return assigned === uname || assigned === uemail || assigned === uusername;
        });
    } else if (user && user.role === 'editor') {
        const userEmail = user.email?.trim().toLowerCase();
        const userName = user.name?.trim().toLowerCase();

        const editorEdits = await EditingTask.find({
            $or: [
                { assignedToEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } },
                { assignedToName: { $regex: new RegExp(`^${userName}$`, 'i') } }
            ]
        });
        const allowedLeadIds = new Set(editorEdits.map(e => e.leadId));
        filteredLeads = leads.filter(l => l.leadId && allowedLeadIds.has(l.leadId));
    } else if (user && user.role === 'shoot') {
        const userEmail = user.email?.trim().toLowerCase();
        const userName = user.name?.trim().toLowerCase();

        const shoots = await Shoot.find({
            $or: [
                { shootMemberEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } },
                { shootMemberName: { $regex: new RegExp(`^${userName}$`, 'i') } }
            ]
        });
        const allowedLeadIds = new Set(shoots.map(s => s.leadId));
        filteredLeads = leads.filter(l => l.leadId && allowedLeadIds.has(l.leadId));
    }

    // Attach latest payment status to leads
    const leadIds = filteredLeads.map(l => l.leadId);
    const payments = await Payment.find({ leadId: { $in: leadIds } });
    const paymentMap = new Map();
    payments.forEach(p => {
        paymentMap.set(p.leadId, p);
    });

    const result = filteredLeads.map(l => {
        const obj = l.toObject();
        obj.id = l._id.toString();
        obj.payment = paymentMap.get(l.leadId) || null;
        return obj;
    });

    return res.status(200).json(new ApiResponse(200, { leads: result }, "Clients retrieved successfully"));
});

const createClient = asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.name || !body.phoneNumber) {
        throw new ApiError(400, "Client name and contact number are required");
    }

    const count = await Client.countDocuments();
    const leadId = body.leadId || `HL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const client = await Client.create({
        leadId,
        phoneNumber: body.phoneNumber || body.contact || "",
        date: body.date || new Date().toLocaleDateString('en-GB'),
        adRefCode: body.adRefCode || "manual",
        source: body.source || "Manual Entry",
        assignedTo: body.assignedTo || req.user?.name || "",
        name: body.name,
        reachoutDone: body.reachoutDone || "Yes",
        servicePitched: body.servicePitched || body.service || "Podcast",
        cost: Number(body.cost || 0),
        status: body.status || "New Lead",
        clientEmail: body.clientEmail || body.email || "",
        proposalSent: Boolean(body.proposalSent),
        proposalAccepted: Boolean(body.proposalAccepted),
        proposalSentAt: body.proposalSentAt || new Date().toISOString()
    });

    return res.status(201).json(new ApiResponse(201, { lead: client }, "Client created successfully"));
});

const updateClient = asyncHandler(async (req, res) => {
    const { leadId } = req.params;
    const updateData = req.body;

    const updated = await Client.findOneAndUpdate(
        { leadId },
        { $set: updateData },
        { new: true }
    );

    if (!updated) {
        throw new ApiError(404, "Client not found");
    }

    return res.status(200).json(new ApiResponse(200, { lead: updated }, "Client updated successfully"));
});

const getClientByLeadId = asyncHandler(async (req, res) => {
    const { leadId } = req.params;
    const client = await Client.findOne({ leadId });
    
    if (!client) {
        throw new ApiError(404, 'Client not found');
    }
    
    return res.status(200).json(new ApiResponse(200, { leads: [client] }, 'Client fetched'));
});

export { getClients, createClient, updateClient, getClientByLeadId };
