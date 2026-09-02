import mongoose from "mongoose";
import dotenv from "dotenv";
import { Client } from "./src/models/client.models.js";
import { Payment } from "./src/models/payment.models.js";
import { Shoot } from "./src/models/shoot.models.js";
import { UpsellCrossSell } from "./src/models/upsellCrossSell.models.js";
import { ClientProfile } from "./src/models/clientProfile.models.js";

dotenv.config();

async function removeAisensy() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const client = await Client.findOne({ phoneNumber: "9098787654" });
    if (!client) {
      console.log("Client Aisensy not found.");
      process.exit(0);
    }
    console.log(`Found client: ${client.name} (leadId: ${client.leadId}, id: ${client._id})`);

    const leadId = client.leadId;

    // Remove from Payment
    const payments = await Payment.deleteMany({ leadId });
    console.log(`Deleted ${payments.deletedCount} payments.`);

    // Remove from Shoot
    const shoots = await Shoot.deleteMany({ leadId });
    console.log(`Deleted ${shoots.deletedCount} shoots.`);

    // Remove from UpsellCrossSell
    const upsells = await UpsellCrossSell.deleteMany({ clientLeadId: leadId });
    console.log(`Deleted ${upsells.deletedCount} upsells.`);

    // Remove from ClientProfile
    const profiles = await ClientProfile.deleteMany({ leadId });
    console.log(`Deleted ${profiles.deletedCount} profiles.`);

    // Remove the Client itself
    await Client.deleteOne({ _id: client._id });
    console.log("Deleted Client Aisensy successfully.");

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

removeAisensy();
