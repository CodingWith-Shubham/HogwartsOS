import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO_URI;
const clientNameToSearch = "final migration on its way";

async function main() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('test'); // The db name from the user's screenshot is 'test'

        console.log(`Searching for records related to client: "${clientNameToSearch}"\n`);
        console.log("--------------------------------------------------");

        // 1. Fetch Client
        const clientsCol = db.collection('clients');
        const clientRecords = await clientsCol.find({ name: clientNameToSearch }).toArray();
        console.log("=== CLIENTS ===");
        console.log(JSON.stringify(clientRecords, null, 2));
        console.log("\n");

        if (clientRecords.length === 0) {
            console.log("No client found. Exiting.");
            return;
        }

        const leadId = clientRecords[0].leadId;
        const clientId = clientRecords[0]._id;

        // 2. Fetch Payments
        const paymentsCol = db.collection('payments');
        const payments = await paymentsCol.find({ leadId: leadId }).toArray();
        console.log("=== PAYMENTS ===");
        console.log(JSON.stringify(payments, null, 2));
        console.log("\n");

        // 3. Fetch Shoots
        const shootsCol = db.collection('shoots');
        const shoots = await shootsCol.find({ leadId: leadId }).toArray();
        console.log("=== SHOOTS ===");
        console.log(JSON.stringify(shoots, null, 2));
        console.log("\n");
        
        let shootId = null;
        if (shoots.length > 0) shootId = shoots[0].shootId;

        // 4. Fetch EditProjects
        const editProjectsCol = db.collection('editprojects');
        const editProjects = await editProjectsCol.find({ leadId: leadId }).toArray();
        console.log("=== EDIT PROJECTS ===");
        console.log(JSON.stringify(editProjects, null, 2));
        console.log("\n");

        // 5. Fetch EditingTasks
        const editingTasksCol = db.collection('editingtasks');
        const editingTasks = await editingTasksCol.find({ leadId: leadId }).toArray();
        console.log("=== EDITING TASKS ===");
        console.log(JSON.stringify(editingTasks, null, 2));
        console.log("\n");

        // 6. Fetch UpsellCrossSells
        const upsellCol = db.collection('upsellcrosssells');
        const upsells = await upsellCol.find({ clientId: clientId }).toArray();
        console.log("=== UPSELL/CROSS-SELLS ===");
        console.log(JSON.stringify(upsells, null, 2));
        console.log("\n");
        
        // 7. Fetch Revisions
        const revisionsCol = db.collection('revisions');
        // revisions use projectId, which might be editId or something else. We'll search by clientName just in case
        const revisions = await revisionsCol.find({ clientName: clientNameToSearch }).toArray();
        console.log("=== REVISIONS ===");
        console.log(JSON.stringify(revisions, null, 2));
        console.log("\n");

        console.log("--------------------------------------------------");
        console.log("Data fetch complete.");

    } catch (e) {
        console.error("Error fetching data:", e);
    } finally {
        await client.close();
    }
}

main().catch(console.error);
