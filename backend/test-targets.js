import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Payment } from './src/models/payment.models.js';
import { Client } from './src/models/client.models.js';
import { UpsellCrossSell } from './src/models/upsellCrossSell.models.js';

dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const payments = await Payment.find({
        $or: [
            { paymentStatus: { $regex: /verified/i } },
            { paymentStatus: { $regex: /confirmed/i } },
            { paymentStatus: { $regex: /cash received/i } }
        ]
    }).limit(10).lean();

    console.log('Sample verified payments:');
    payments.forEach(p => {
        console.log(`Amount: ${p.amount}, verifiedAt: ${p.verifiedAt}, createdAt: ${p.createdAt}`);
    });

    // Test the logic
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

    console.log(`\nTotal verified payments found: ${allVerifiedPayments.length}`);

    // Fetch clients and upsells to map leads/upsells to sales rep
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

    const achievements = {};

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
                achievements[assignedTo] = (achievements[assignedTo] || 0) + Number(p.amount);
            }
        }
    });

    console.log('\nCalculated Achievements for 2026-09:');
    console.log(achievements);

    mongoose.disconnect();
}

run().catch(console.error);
