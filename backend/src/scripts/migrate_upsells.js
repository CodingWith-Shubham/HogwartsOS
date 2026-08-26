import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { UpsellCrossSell } from '../models/upsellCrossSell.models.js';
import { Client } from '../models/client.models.js';
import { Shoot } from '../models/shoot.models.js';
import { MarketingTask } from '../models/marketing.models.js';

const EDITING_ONLY_SERVICE_REGEX = /only[\s-]*editing/i;
const MARKETING_SERVICE_REGEX = /marketing/i;

const isEditingOnly = (upsell) => {
    if (upsell.services?.some(s => EDITING_ONLY_SERVICE_REGEX.test(s || ''))) return true;
    const sets = upsell.deliverableSets?.length ? upsell.deliverableSets : upsell.deliverable_sets;
    if (sets?.some(s => EDITING_ONLY_SERVICE_REGEX.test(s.serviceName || ''))) return true;
    return false;
};

const isMarketing = (upsell) => {
    if (upsell.services?.some(s => MARKETING_SERVICE_REGEX.test(s || ''))) return true;
    const sets = upsell.deliverableSets?.length ? upsell.deliverableSets : upsell.deliverable_sets;
    if (sets?.some(s => MARKETING_SERVICE_REGEX.test(s.serviceName || ''))) return true;
    return false;
};

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const upsells = await UpsellCrossSell.find({
            status: { $in: ['payment_done', 'editing', 'delivered', 'shoot_scheduled', 'shoot_done'] }
        });

        console.log(`Found ${upsells.length} paid upsells to check`);

        for (const upsell of upsells) {
            const needsEditing = isEditingOnly(upsell);
            const needsMarketing = isMarketing(upsell);

            if (needsEditing) {
                const searchFilter = { upsellCrossSellId: upsell._id.toString(), isEditingOnly: true };
                const existingShoot = await Shoot.findOne(searchFilter);
                if (!existingShoot) {
                    const shootId = `EDITONLY_UPSELL_${upsell._id.toString()}`;
                    await Shoot.create({
                        shootId,
                        leadId: upsell.clientLeadId,
                        clientName: upsell.clientName || "",
                        contactNum: upsell.clientPhone || "",
                        clientEmailId: upsell.clientEmail || "",
                        shootDate: "",
                        shootStartTime: "",
                        shootEndTime: "",
                        camera: "",
                        teleprompter: "No",
                        totalHours: "",
                        assignedTo: upsell.assignedTo || "",
                        bts: "No",
                        shootMemberName: "",
                        shootMemberEmail: "",
                        dataLink: "",
                        driveLinkUploaded: true,
                        isEditingOnly: true,
                        setName: "",
                        upsellCrossSellId: upsell._id.toString()
                    });
                    console.log(`Created Editing virtual shoot for Upsell: ${upsell.clientName}`);
                }
            }

            if (needsMarketing) {
                const searchFilter = { leadId: upsell.clientLeadId, taskId: { $regex: `MKT_UPSELL_${upsell._id.toString()}` } };
                const existingTask = await MarketingTask.findOne(searchFilter);
                if (!existingTask) {
                    let months = "", posts = "", socialMediaHandles = "", marketingNotes = "";
                    const sets = upsell.deliverableSets?.length ? upsell.deliverableSets : upsell.deliverable_sets;
                    if (sets && Array.isArray(sets)) {
                        const mktSet = sets.find(s => s.serviceName?.toLowerCase() === 'only marketing');
                        if (mktSet) {
                            months = mktSet.months || "";
                            posts = mktSet.posts || "";
                            socialMediaHandles = mktSet.socialMediaHandles || mktSet.social_media_handles || "";
                            marketingNotes = mktSet.marketingNotes || mktSet.marketing_notes || "";
                        }
                    }

                    await MarketingTask.create({
                        taskId: `MKT_UPSELL_${upsell._id.toString()}`,
                        leadId: upsell.clientLeadId,
                        clientName: upsell.clientName || "",
                        status: "Unassigned",
                        months,
                        posts,
                        socialMediaHandles,
                        marketingNotes
                    });
                    console.log(`Created Marketing task for Upsell: ${upsell.clientName}`);
                }
            }
        }
        console.log('Migration complete');
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

migrate();
