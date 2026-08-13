import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const clearDatabase = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully!");

        const collections = await mongoose.connection.db.collections();
        
        for (let collection of collections) {
            const collectionName = collection.collectionName;
            
            // Skip the users collection
            if (collectionName === "users") {
                console.log(`Skipping collection: ${collectionName}`);
                continue;
            }

            console.log(`Clearing collection: ${collectionName}...`);
            await collection.deleteMany({});
            console.log(`Successfully cleared ${collectionName}`);
        }

        console.log("Database cleared successfully (except users collection)!");
    } catch (error) {
        console.error("Error clearing database:", error);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed.");
    }
};

clearDatabase();
