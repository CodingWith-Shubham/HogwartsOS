import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function fix() {
    await mongoose.connect('mongodb+srv://info_db_user:0WK0NPbNJRceeMLY@cluster0.tsg6tmi.mongodb.net/?appName=Cluster0');
    const { Payment } = await import('./src/models/payment.models.js');
    const { Shoot } = await import('./src/models/shoot.models.js');
    const { default: EditProject } = await import('./src/models/editing.models.js');

    const payments = await Payment.find({
        installmentLabel: "Revision Addon",
        $or: [{ upsellCrossSellId: { $exists: false } }, { upsellCrossSellId: "" }]
    });

    console.log(`Found ${payments.length} Revision Addon payments missing upsellCrossSellId`);

    let fixed = 0;
    for (const p of payments) {
        const project = await EditProject.findOne({ leadId: p.leadId });
        if (project && project.shootId) {
            const shoot = await Shoot.findOne({ shootId: project.shootId });
            if (shoot && shoot.upsellCrossSellId) {
                p.upsellCrossSellId = shoot.upsellCrossSellId;
                await p.save();
                fixed++;
                console.log(`Fixed payment ${p.paymentId || p._id} with upsellCrossSellId ${shoot.upsellCrossSellId}`);
            }
        }
    }

    console.log(`Successfully fixed ${fixed} payments`);
    process.exit(0);
}

fix().catch(console.error);
