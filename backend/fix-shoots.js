import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Shoot = mongoose.model('Shoot', new mongoose.Schema({}, { strict: false }));
  const res = await Shoot.updateMany({ bookingStatus: { $in: ['cancelled', 'conflict'] } }, { $set: { deliverableSetIndex: -1 } });
  console.log('Updated:', res);
  process.exit(0);
}
run().catch(console.error);
