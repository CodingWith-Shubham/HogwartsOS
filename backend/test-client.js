import 'dotenv/config';
import connectDB from './src/db/dbConnection.js';
import { Client } from './src/models/client.models.js';

async function test() {
  await connectDB();
  const clients = await Client.find({ name: { $regex: 'fleet', $options: 'i' } }).lean();
  console.log(JSON.stringify(clients, null, 2));
  process.exit(0);
}
test();
