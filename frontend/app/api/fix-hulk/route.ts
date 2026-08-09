import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://localhost:8000/api/v1/shoots');
    const data = await res.json();
    
    const fixShoot = async (clientName: string) => {
      const shoots = data.data.shoots.filter((s: any) => s.clientName === clientName);
      shoots.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      if (shoots.length > 1) {
        const shootId = shoots[1].shootId;
        await fetch(`http://localhost:8000/api/v1/shoots/${shootId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deliverable_set_index: 1 })
        });
        return shootId;
      }
      return null;
    };

    const fixed1 = await fixShoot('The Final Try');
    const fixed2 = await fixShoot('the last try');

    return NextResponse.json({ success: true, fixed: { 'The Final Try': fixed1, 'the last try': fixed2 } });
  } catch(e: any) { 
    return NextResponse.json({ error: e.message }); 
  }
}
