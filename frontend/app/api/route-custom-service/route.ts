import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAccessToken } from '@/lib/auth-server';
import fs from 'fs';
import path from 'path';

function logToDisk(msg: string) {
  try {
    fs.appendFileSync(path.join(process.cwd(), 'scratch_api_log.txt'), new Date().toISOString() + ': ' + msg + '\n');
  } catch(e) {}
}

export async function POST(request: Request) {
  try {
    logToDisk('--- New POST request to /api/route-custom-service ---');
    const body = await request.json();
    logToDisk('Body parsed: ' + JSON.stringify(body));

    const { 
      leadId, 
      deliverableSetIndex, 
      team, 
      assignedMember, 
      shootDate, 
      shootStartTime, 
      shootEndTime, 
      editDuration, 
      editType, 
      marketingComments,
      customDetails
    } = body;

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(request.headers);
    logToDisk(`BACKEND_URL: ${BACKEND_URL}, token length: ${token?.length}`);

    // 1. Fetch the lead to get its current deliverable_sets
    logToDisk(`Fetching lead ${leadId} from backend...`);
    const getRes = await fetch(`${BACKEND_URL}/clients/${leadId}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      }
    });
    
    if (!getRes.ok) {
      const errText = await getRes.text();
      logToDisk(`getRes not ok. Status: ${getRes.status}. Body: ${errText}`);
      throw new Error(`Failed to fetch lead: ${getRes.status} - ${errText}`);
    }
    
    const data = await getRes.json();
    logToDisk('Lead fetch response parsed.');
    
    const lead = data.data?.leads?.[0] || data.data?.lead || data.data?.client || data.client || data.data;

    if (!lead) {
      logToDisk('Failed to extract lead: ' + JSON.stringify(data));
      throw new Error('Failed to extract lead from response: ' + JSON.stringify(data));
    }

    let sets = lead.deliverableSets || [];
    if (!sets || sets.length === 0) {
      sets = lead.deliverable_sets || [];
    }
    
    if (!sets[deliverableSetIndex]) {
      logToDisk(`Deliverable set at index ${deliverableSetIndex} not found in ${JSON.stringify(sets)}`);
      throw new Error('Deliverable set not found.');
    }

    // 2. Mark as assigned
    sets[deliverableSetIndex].assignedTeam = team;
    sets[deliverableSetIndex].assignedMember = assignedMember;

    // 3. Update the lead in DB
    logToDisk('Sending PUT request to update lead...');
    const updateRes = await fetch(`${BACKEND_URL}/clients/${leadId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ deliverable_sets: sets, deliverableSets: sets }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      logToDisk(`updateRes not ok. Status: ${updateRes.status}. Body: ${errText}`);
      throw new Error(`Failed to update lead deliverable sets. Status: ${updateRes.status} - ${errText}`);
    }
    logToDisk('Lead successfully updated in DB.');

    // 4. Trigger the appropriate webhook downstream
    logToDisk(`Triggering webhook for team: ${team}`);
    if (team === 'shoot') {
      await fetch('https://n8n.hogwartsstudios.com/webhook/schedule-shoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          deliverableSetIndex,
          camera: 'Custom',
          recordTime: shootStartTime + ' to ' + shootEndTime,
          studioTime: shootDate,
          shootMembers: [{ name: assignedMember }],
          serviceName: 'Others',
        }),
      }).catch(err => logToDisk('Webhook error: ' + err.message));
    } else if (team === 'edit') {
      await fetch('https://n8n.hogwartsstudios.com/webhook/assign-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          lead_id: leadId,
          deliverableSetIndex,
          editorName: assignedMember,
          editor_name: assignedMember,
          serviceName: 'Others',
          service_type: 'Others',
          editDuration,
          editType,
          customDetails,
        }),
      }).catch(err => logToDisk('Webhook error: ' + err.message));
    }
    
    logToDisk('Done processing. Returning success: true');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logToDisk('Route Custom Service error catch block: ' + error.message);
    console.error('Route Custom Service error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
