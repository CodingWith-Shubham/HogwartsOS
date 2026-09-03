import mongoose from "mongoose";
import { Shoot } from "./src/models/shoot.models.js";
import { UpsellCrossSell } from "./src/models/upsellCrossSell.models.js";
import { config } from "dotenv";

config();

async function fixUpsellShoots() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB.");

  const shoots = await Shoot.find({ upsellCrossSellId: { $ne: "" }, $or: [{ recordTime: "" }, { recordTime: { $exists: false } }] });
  console.log(`Found ${shoots.length} upsell shoots with missing recordTime.`);

  for (const shoot of shoots) {
    const upsell = await UpsellCrossSell.findById(shoot.upsellCrossSellId);
    if (!upsell) continue;

    let recordTime = "";
    let studioTime = "";

    // In ScheduleShootDialog, for upsells, deliverable_set_index is offset by (existingShoots.length + 1) * 100
    // So the actual index is shoot.deliverableSetIndex % 100.
    const actualIndex = (shoot.deliverableSetIndex || 0) % 100;
    
    let sets = upsell.deliverableSets;
    if (!sets || sets.length === 0) sets = upsell.deliverable_sets || [];
    if (sets.length > actualIndex && sets[actualIndex]) {
        if (sets[actualIndex].recordTime) recordTime = sets[actualIndex].recordTime;
        if (sets[actualIndex].studioTime) studioTime = sets[actualIndex].studioTime;
    }

    if (recordTime || studioTime) {
      shoot.recordTime = recordTime;
      shoot.studioTime = studioTime;
      await shoot.save();
      console.log(`Updated upsell shoot ${shoot.shootId} with recordTime: ${recordTime}, studioTime: ${studioTime}`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

fixUpsellShoots().catch(console.error);
