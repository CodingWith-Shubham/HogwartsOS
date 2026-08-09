import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  try {
    await mongoose.connect('mongodb+srv://admin:admin@cluster0.p7p0miz.mongodb.net/Hogwarts_os?retryWrites=true&w=majority&appName=Cluster0');
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
