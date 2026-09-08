/**
 * import-old-client-sheet.js
 * --------------------------
 * Imports the legacy client list from the "Old Client sheet" tab of
 * "Old client+Shoot Pending+ Editing Pending (1).xlsx" directly into the
 * CRM database as EXISTING clients.
 *
 * Same rules as the earlier migration import:
 *   - imported records get isExistingClient: true + status "Existing Client"
 *     -> they APPEAR in the Clients tab and NEVER in the Sales dashboard
 *   - ADDITIVE ONLY: existing DB records are never updated or deleted
 *   - duplicates are skipped (by phone / email against the DB, and within the sheet)
 *
 * Usage:
 *   node import-old-client-sheet.js          -> live import from the default file
 *   node import-old-client-sheet.js --dry    -> dry run (no writes)
 *   node import-old-client-sheet.js <file> [--dry]
 */
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import xlsx from 'xlsx';
import { Client } from './src/models/client.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const DEFAULT_FILE = 'c:\\Users\\mamga\\OneDrive\\Desktop\\HogwartsOS\\hogwarts_studio_crm\\Old client+Shoot Pending+ Editing Pending (1).xlsx';
const SHEET_NAME = 'Old Client sheet';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry');
const fileArg = args.find(a => !a.startsWith('--'));
const FILE_PATH = fileArg ? path.resolve(fileArg) : DEFAULT_FILE;

// Normalize phone to its last 10 digits so "+91 98765 43210" == "9876543210"
const normPhone = (v) => {
    let d = String(v ?? '').replace(/[^\d]/g, '');
    if (d.length > 10) d = d.slice(-10);
    return d;
};
const normEmail = (v) => {
    const e = String(v ?? '').trim().toLowerCase();
    // Treat placeholder junk like ".", "-", "na" as empty — a real email contains "@"
    return e.includes('@') ? e : '';
};
const normName = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


const run = async () => {
    if (!fs.existsSync(FILE_PATH)) throw new Error(`Input file not found: ${FILE_PATH}`);
    console.log(`Source file : ${FILE_PATH}`);
    console.log(`Mode        : ${DRY_RUN ? 'DRY RUN (nothing will be written)' : 'LIVE IMPORT'}\n`);

    const workbook = xlsx.readFile(FILE_PATH);
    const sheetName = workbook.SheetNames.includes(SHEET_NAME) ? SHEET_NAME : workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    console.log(`Rows found in "${sheetName}": ${rows.length}\n`);

    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to MongoDB: "${mongoose.connection.db.databaseName}"\n`);

    let created = 0, skippedDuplicate = 0, skippedInvalid = 0;
    const seen = new Set();

    for (const [idx, row] of rows.entries()) {
        const rowNo = idx + 1;
        const name = String(row['Client Name'] ?? row.name ?? '').trim();
        const phone = normPhone(row['Ph No.'] ?? row.phoneNumber);
        const email = normEmail(row['Email ID'] ?? row.clientEmail);

        if (!name && !phone && !email) {
            console.log(`SKIP Row ${rowNo}: empty row`);
            skippedInvalid++;
            continue;
        }

        // De-dupe within the sheet
        const key = phone ? `p:${phone}` : email ? `e:${email}` : `n:${normName(name)}`;
        if (seen.has(key)) {
            console.log(`SKIP Row ${rowNo}: "${name}" duplicates an earlier row in the sheet`);
            skippedDuplicate++;
            continue;
        }
        seen.add(key);

        // De-dupe against the DB — NEVER overwrite existing records.
        // Rows without phone+email are matched by exact (normalized) name only.
        const db = mongoose.connection.db.collection('clients');
        const dupOr = [];
        if (phone) dupOr.push({ phoneNumber: { $regex: new RegExp(`${phone}$`) } });
        if (email) dupOr.push({ clientEmail: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') } });
        if (!phone && !email) dupOr.push({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } });

        const existing = dupOr.length ? await db.findOne({ $or: dupOr }, { projection: { leadId: 1, name: 1 } }) : null;
        if (existing) {
            console.log(`SKIP Row ${rowNo}: "${name}" already exists in DB as ${existing.leadId} ("${existing.name}") — existing record untouched`);
            skippedDuplicate++;
            continue;
        }

        const doc = {
            leadId: `HL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            name: name || 'Unknown Client',
            phoneNumber: phone,
            clientEmail: email,
            leadType: 'lead',
            assignedTo: '',
            status: 'Existing Client',
            isExistingClient: true,
            cost: 0,
            remainingAmount: '0',
            proposalSent: true,
            proposalAccepted: true,
            proposalSentAt: new Date().toISOString(),
            deliverableSets: [],
            servicePitched: '',
            serviceNotes: '',
            date: new Date().toLocaleDateString('en-GB'),
            adRefCode: 'existing-import',
            source: 'Existing Client Import',
            reachoutDone: 'yes',
        };

        if (DRY_RUN) {
            console.log(`DRY  Row ${rowNo}: WOULD import "${doc.name}" — phone: ${doc.phoneNumber || '-'}, email: ${doc.clientEmail || '-'}`);
            created++;
            continue;
        }

        await Client.create(doc);
        console.log(`OK   Row ${rowNo}: imported "${doc.name}" (${doc.leadId})`);
        created++;
    }

    console.log('\n----------------------------------------');
    console.log('SUMMARY');
    console.log(`   Rows in sheet      : ${rows.length}`);
    console.log(`   ${DRY_RUN ? 'Would import' : 'Imported'}         : ${created}`);
    console.log(`   Skipped (duplicate): ${skippedDuplicate}`);
    console.log(`   Skipped (invalid)  : ${skippedInvalid}`);
    console.log('----------------------------------------');

    await mongoose.disconnect();
    process.exit(0);
};

run().catch(async (err) => {
    console.error('Import failed:', err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
});
