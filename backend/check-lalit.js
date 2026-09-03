import mongoose from "mongoose";
import { Shoot } from "./src/models/shoot.models.js";
import { Client } from "./src/models/client.models.js";
import { config } from "dotenv";

config();

async function checkLalit() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB.");

  const shoots = await Shoot.find({ clientName: /Lalit Taneja/i });
  console.log("Shoots for Lalit Taneja:");
  console.log(JSON.stringify(shoots, null, 2));

  for (const shoot of shoots) {
      const client = await Client.findOne({ leadId: shoot.leadId });
      console.log(`\nClient for leadId ${shoot.leadId}:`);
      if (client) {
        console.log(`recordTime: ${client.recordTime}`);
        console.log(`deliverableSets: ${JSON.stringify(client.deliverableSets || client.deliverable_sets)}`);
      } else {
        console.log("Client not found.");
      }
  }

  process.exit(0);
}

checkLalit().catch(console.error);
