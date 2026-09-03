import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Payment } from './src/models/payment.models.js';
import { Client } from './src/models/client.models.js';
import { UpsellCrossSell } from './src/models/upsellCrossSell.models.js';

dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Period setup
    const period = '2026-09';
    const [year, month] = period.split('-');
    const startDate = new Date(year, parseInt(month) - 1, 1);
    const endDate = new Date(year, parseInt(month), 0, 23, 59, 59, 999);

    const allVerifiedPayments = await Payment.find({
        $or: [
            { paymentStatus: { $regex: /verified/i } },
            { paymentStatus: { $regex: /confirmed/i } },
            { paymentStatus: { $regex: /cash received/i } }
        ]
    }).lean();

    const clients = await Client.find({}, 'leadId assignedTo name').lean();
    const clientMap = clients.reduce((acc, c) => {
        if (c.leadId) acc[c.leadId] = { assignedTo: c.assignedTo, name: c.name, type: 'Lead' };
        return acc;
    }, {});

    const upsells = await UpsellCrossSell.find({}, '_id assignedTo clientName type').lean();
    const upsellMap = upsells.reduce((acc, u) => {
        acc[u._id.toString()] = { assignedTo: u.assignedTo, name: u.clientName, type: `Upsell (${u.type})` };
        return acc;
    }, {});

    console.log("== PAYMENTS FOR ISHA MALHOTRA (2026-09) ==\n");
    let total = 0;

    allVerifiedPayments.forEach(p => {
        let paymentDate = null;
        if (p.verifiedAt) paymentDate = new Date(p.verifiedAt);
        else if (p.createdAt) paymentDate = new Date(p.createdAt);
        else if (p.paymentLinkSentAt) paymentDate = new Date(p.paymentLinkSentAt);

        if (paymentDate && !isNaN(paymentDate.getTime()) && paymentDate >= startDate && paymentDate <= endDate) {
            let assignedTo = null;
            let sourceName = '';
            let sourceType = '';
            let sourceId = '';
            
            if (p.upsellCrossSellId && upsellMap[p.upsellCrossSellId]) {
                assignedTo = upsellMap[p.upsellCrossSellId].assignedTo;
                sourceName = upsellMap[p.upsellCrossSellId].name;
                sourceType = upsellMap[p.upsellCrossSellId].type;
                sourceId = p.upsellCrossSellId;
            } else if (p.leadId && clientMap[p.leadId]) {
                assignedTo = clientMap[p.leadId].assignedTo;
                sourceName = clientMap[p.leadId].name;
                sourceType = clientMap[p.leadId].type;
                sourceId = p.leadId;
            }

            // Check for both Exact matches or Substring matches, since sales rep string might vary
            if (assignedTo && assignedTo.includes('Isha')) {
                console.log(`Payment: ₹${p.amount}`);
                console.log(`Date: ${paymentDate.toISOString().split('T')[0]}`);
                console.log(`Client/Lead: ${sourceName} (${sourceType} - ${sourceId})`);
                console.log(`Status: ${p.paymentStatus}`);
                console.log('---------------------------');
                total += Number(p.amount || 0);
            }
        }
    });

    console.log(`\nGRAND TOTAL COLLECTED: ₹${total}`);
    mongoose.disconnect();
}

run().catch(console.error);
