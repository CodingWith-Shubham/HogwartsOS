import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://localhost:8000/api/v1/shoots');
    const data = await res.json();
    const shoots = data.data.shoots.filter((s: any) => s.clientName === 'hulk');
    shoots.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    if (shoots.length > 1) {
      const shootId = shoots[1].shootId;
      const updateRes = await fetch(`http://localhost:8000/api/v1/shoots/${shootId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverableSetIndex: 1 })
      });
      return NextResponse.json({ success: true, fixed: shootId });
    }
    return NextResponse.json({ success: false, msg: 'Not found' });
  } catch(e: any) { 
    return NextResponse.json({ error: e.message }); 
  }
}
