import mongoose from 'mongoose';
import { MarketingTask } from './src/models/marketing.models.js';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Hogwarts_crm";

async function run() {
  await mongoose.connect(MONGODB_URI);
  const tasks = await MarketingTask.find({});
  console.log("Tasks found:", tasks.length);
  console.log(JSON.stringify(tasks, null, 2));
  process.exit(0);
}

run();
