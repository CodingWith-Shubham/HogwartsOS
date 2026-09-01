/**
 * One-time migration: converts the old single refreshToken string
 * to the new refreshTokens array for all existing users.
 *
 * Run with: node src/scripts/migrate_refresh_tokens.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Load .env from the backend root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ No MONGO_URI found in .env");
  process.exit(1);
}

async function migrate() {
  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  const usersCollection = mongoose.connection.db.collection("users");

  // Find all users that still have the old single `refreshToken` string
  const usersToMigrate = await usersCollection
    .find({ refreshToken: { $exists: true, $type: "string" } })
    .toArray();

  console.log(`📋 Found ${usersToMigrate.length} user(s) with old refreshToken field`);

  let migrated = 0;
  for (const user of usersToMigrate) {
    const existingTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
    const newTokens = user.refreshToken
      ? [...existingTokens, user.refreshToken]
      : existingTokens;

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: { refreshTokens: newTokens },
        $unset: { refreshToken: "" },
      }
    );
    migrated++;
  }

  // Ensure all remaining users have the refreshTokens array initialized
  const result = await usersCollection.updateMany(
    { refreshTokens: { $exists: false } },
    { $set: { refreshTokens: [] } }
  );

  console.log(`✅ Migrated ${migrated} user(s) with existing refresh tokens`);
  console.log(`✅ Initialized refreshTokens array on ${result.modifiedCount} additional user(s)`);

  await mongoose.disconnect();
  console.log("✅ Done. Migration complete.");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
