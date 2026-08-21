import { Client } from "../models/client.models.js";
import { User } from "../models/user.models.js";
import { sendPushNotification } from "../services/notification.service.js";
import { EditProject, EditingTask } from "../models/editing.models.js";
import { Shoot } from "../models/shoot.models.js";
import { Payment } from "../models/payment.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { ClientProfile } from "../models/clientProfile.models.js";
import { asyncHandler } from "../utils/async-handler.js";

const getClients = asyncHandler(async (req, res) => {
    const user = req.user;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.leadType = req.query.type;

    let query = Client.find(filter).sort({ createdAt: -1 });
    if (req.query.limit) query = query.limit(Number(req.query.limit));

    let leads = await query;

    let filteredLeads = leads;

    if (user && (user.role === 'super_admin' || user.role === 'admin' || user.role === 'manager')) {
        // Super admins, admins, and managers see all leads, no filtering required.
        filteredLeads = leads;
    } else if (user && user.role === 'sales') {
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

    // Attach latest payment status to leads.
    // Payments are already sorted by createdAt DESC so the first payment
    // encountered for each leadId is the most recent one.
    const leadIds = filteredLeads.map(l => l.leadId);
    const payments = await Payment.find({ leadId: { $in: leadIds } }).sort({ createdAt: -1 });
    const paymentMap = new Map();
    payments.forEach(p => {
        // Upsell/cross-sell payments belong to the parallel pipeline — never
        // surface them as the original lead's payment status.
        if (p.upsellCrossSellId) return;
        // Only set if not already set — keeps the most recent payment per lead
        if (!paymentMap.has(p.leadId)) {
            paymentMap.set(p.leadId, p);
        }
    });

    const clientEmails = filteredLeads.map(l => (l.clientEmail || l.email || '').trim().toLowerCase()).filter(Boolean);
    const clientPhones = filteredLeads.map(l => (l.phoneNumber || l.contact || '').trim()).filter(Boolean);
    
    const profiles = await ClientProfile.find({
        $or: [
            { email: { $in: clientEmails } },
            { phone: { $in: clientPhones } }
        ]
    }).select("email phone profileImage").lean();

    const result = filteredLeads.map(l => {
        const obj = typeof l.toObject === 'function' ? l.toObject() : { ...l };
        obj.id = l._id.toString();
        obj.payment = paymentMap.get(l.leadId) || null;
        if (obj.deliverable_sets && (!obj.deliverableSets || obj.deliverableSets.length === 0)) {
            obj.deliverableSets = obj.deliverable_sets;
        }

        const lEmail = (l.clientEmail || l.email || '').trim().toLowerCase();
        const lPhone = (l.phoneNumber || l.contact || '').trim();
        const profile = profiles.find(p => 
            (p.email && p.email.toLowerCase() === lEmail) || 
            (p.phone && p.phone === lPhone)
        );
        obj.profileImage = profile ? profile.profileImage : "";

        return obj;
    });

    return res.status(200).json(new ApiResponse(200, { leads: result }, "Clients retrieved successfully"));
});

const createClient = asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.name || !body.phoneNumber) {
        throw new ApiError(400, "Client name and contact number are required");
    }

    const phoneNumber = body.phoneNumber || body.contact || "";
    const clientEmail = body.clientEmail || body.email || "";

    const duplicateQuery = { $or: [] };
    if (phoneNumber) duplicateQuery.$or.push({ phoneNumber });
    if (clientEmail) duplicateQuery.$or.push({ clientEmail });

    if (duplicateQuery.$or.length > 0) {
        const existingClient = await Client.findOne(duplicateQuery);
        if (existingClient) {
            const matchType = existingClient.phoneNumber === phoneNumber ? 'phone number' : 'email address';
            throw new ApiError(409, `A lead with this ${matchType} already exists (Lead ID: ${existingClient.leadId}).`);
        }
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

    // Do not update the main client lead if this update comes from an upsell workflow
    if (updateData.upsellCrossSellId && updateData.upsellCrossSellId.trim() !== "") {
        const existing = await Client.findOne({ leadId });
        if (!existing) throw new ApiError(404, "Client not found");
        return res.status(200).json(new ApiResponse(200, { lead: existing }, "Ignored main lead update since this is an upsell payment"));
    }

    const phoneNumber = updateData.phoneNumber || updateData.contact || "";
    const clientEmail = updateData.clientEmail || updateData.email || "";

    const duplicateQuery = { $or: [] };
    if (phoneNumber) duplicateQuery.$or.push({ phoneNumber });
    if (clientEmail) duplicateQuery.$or.push({ clientEmail });

    if (duplicateQuery.$or.length > 0) {
        const existingClient = await Client.findOne({
            $and: [
                { leadId: { $ne: leadId } },
                duplicateQuery
            ]
        });
        if (existingClient) {
            const matchType = existingClient.phoneNumber === phoneNumber ? 'phone number' : 'email address';
            throw new ApiError(409, `Another lead with this ${matchType} already exists (Lead ID: ${existingClient.leadId}).`);
        }
    }

    const updated = await Client.findOneAndUpdate(
        { leadId },
        { $set: updateData },
        { new: true }
    );

    if (!updated) {
        throw new ApiError(404, "Client not found");
    }

    // Notifications
    if (updateData.status === 'Proposal Revoked') {
        const notifyUserIds = [];
        if (updated.assignedTo) {
            const salesUser = await User.findOne({
                $or: [
                    { name: new RegExp(`^${updated.assignedTo}$`, 'i') },
                    { email: new RegExp(`^${updated.assignedTo}$`, 'i') },
                    { username: new RegExp(`^${updated.assignedTo}$`, 'i') }
                ]
            });
            if (salesUser) notifyUserIds.push(salesUser._id);
        }
        sendPushNotification({ userIds: notifyUserIds, roles: ['admin', 'super_admin'] }, {
            title: 'Proposal Revoked',
            message: `The proposal for ${updated.name} has been revoked.`,
            href: '/sales'
        }).catch(console.error);
    }

    return res.status(200).json(new ApiResponse(200, { lead: updated }, "Client updated successfully"));
});

const getClientByLeadId = asyncHandler(async (req, res) => {
    const { leadId } = req.params;
    const client = await Client.findOne({ leadId });
    
    if (!client) {
        throw new ApiError(404, 'Client not found');
    }
    
    const obj = client.toObject();
    if (obj.deliverable_sets && (!obj.deliverableSets || obj.deliverableSets.length === 0)) {
        obj.deliverableSets = obj.deliverable_sets;
    }
    
    return res.status(200).json(new ApiResponse(200, { leads: [obj] }, 'Client fetched'));
});

const deleteClient = asyncHandler(async (req, res) => {
    const { leadId } = req.params;

    const deleted = await Client.findOneAndDelete({ leadId });

    if (!deleted) {
        throw new ApiError(404, "Client not found");
    }

    return res.status(200).json(new ApiResponse(200, { lead: deleted }, "Client deleted successfully"));
});

export { getClients, createClient, updateClient, getClientByLeadId, deleteClient };
