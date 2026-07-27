import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO_URI;
mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB');
    const db = mongoose.connection.db;
    
    // Find payments that were auto-verified by the system recently and have a screenshot
    const payments = await db.collection('payments').find({
      paymentStatus: 'Payment Verified',
      verifiedBy: 'System',
      screenshotUrl: { $ne: '' }
    }).toArray();
    
    console.log(Found  auto-verified payments.);
    
    for (const p of payments) {
      console.log(Fixing payment  for lead );
      await db.collection('payments').updateOne(
        { _id: p._id },
        { $set: { paymentStatus: 'Screenshot Received' } }
      );
      
      await db.collection('clients').updateOne(
        { leadId: p.leadId },
        { $set: { status: 'Payment Under Review' } }
      );
    }
    
    console.log('Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });