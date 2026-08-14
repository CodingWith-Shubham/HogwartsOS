import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const clearDatabase = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is not defined in the environment variables.");
        }

        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB successfully.");

        // Get all collections directly from the MongoDB driver
        const collections = await mongoose.connection.db.collections();
        
        let droppedCount = 0;
        let skippedCount = 0;

        for (const collection of collections) {
            const collectionName = collection.collectionName;

            // Check if it's the users collection
            if (collectionName === "users" || collectionName === "user") {
                console.log(`⏭️  Skipping collection: ${collectionName}`);
                skippedCount++;
                continue;
            }
            
            // Drop the collection
            await collection.drop();
            console.log(`✅ Dropped collection: ${collectionName}`);
            droppedCount++;
        }

        console.log(`\n🎉 Database clear complete!`);
        console.log(`Dropped ${droppedCount} collections.`);
        console.log(`Skipped ${skippedCount} collections.`);
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Error clearing database:", error);
        process.exit(1);
    }
};

clearDatabase();
