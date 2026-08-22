import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI not defined");
    await mongoose.connect(uri);
    // Using native driver to bypass Mongoose schema
    const db = mongoose.connection.db;
    const shoots = await db?.collection('shoots').find({ clientName: 'The Final Try' }).toArray();
    
    return NextResponse.json({ success: true, shoots: shoots?.map(s => ({
      _id: s._id,
      shootId: s.shootId,
      deliverable_set_index: s.deliverable_set_index,
      deliverableSetIndex: s.deliverableSetIndex,
      clientName: s.clientName
    })) });
  } catch(e: any) { 
    return NextResponse.json({ error: e.message }); 
  }
}
