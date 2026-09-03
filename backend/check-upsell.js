import mongoose from "mongoose";
import { UpsellCrossSell } from "./src/models/upsellCrossSell.models.js";
import { config } from "dotenv";

config();

async function checkUpsell() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB.");

  const upsellId = "6a994e1852294faf579c1bc2";
  const upsell = await UpsellCrossSell.findById(upsellId);
  console.log("Upsell entry:");
  console.log(JSON.stringify(upsell, null, 2));

  process.exit(0);
}

checkUpsell().catch(console.error);
