/**
 * import-existing-clients.js
 * --------------------------
 * Embeds the OLD client database (the "Clients" sheet exported from the
 * Google Sheet) directly into the CRM database.
 *
 * Every imported record is flagged `isExistingClient: true` with status
 * "Existing Client" so that it:
 *   - APPEARS in the Clients tab
 *   - NEVER appears in the Sales dashboard (existing clients are not new leads)
 *
 * The script is ADDITIVE ONLY — it never updates or deletes existing records.
 * Rows whose leadId / phone number / email already exist in the DB are skipped.
 *
 * Usage:
 *   node import-existing-clients.js            -> import from the default xlsx
 *   node import-existing-clients.js --dry      -> dry run (no writes)
 *   node import-existing-clients.js <file.csv|file.xlsx> [--dry]
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

const DEFAULT_FILE = 'c:\\Users\\mamga\\OneDrive\\Desktop\\HogwartsOS\\Hogwarts_CRM_Migration_Mapped.xlsx';
const SHEET_NAME = 'Clients';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry');
const fileArg = args.find(a => !a.startsWith('--'));
const FILE_PATH = fileArg ? path.resolve(fileArg) : DEFAULT_FILE;

const normalizePhone = (v) => String(v ?? '').replace(/[^\d+]/g, '').trim();
const normalizeEmail = (v) => String(v ?? '').trim().toLowerCase();
const toGBDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB');
};

const readRows = (filePath) => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Input file not found: ${filePath}`);
    }
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames.includes(SHEET_NAME) ? SHEET_NAME : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(sheet, { defval: '' });
};


const run = async () => {
    console.log(`Source file : ${FILE_PATH}`);
    console.log(`Mode        : ${DRY_RUN ? 'DRY RUN (nothing will be written)' : 'LIVE IMPORT'}\n`);

    const rows = readRows(FILE_PATH);
    console.log(`Rows found in "${SHEET_NAME}" sheet: ${rows.length}\n`);

    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to MongoDB: "${mongoose.connection.db.databaseName}"\n`);

    let created = 0;
    let skippedDuplicate = 0;
    let skippedInvalid = 0;
    const seenInSheet = new Set();

    for (const [idx, row] of rows.entries()) {
        const rowNo = idx + 1;
        const name = String(row.name ?? '').trim();
        const phone = normalizePhone(row.phoneNumber);
        const email = normalizeEmail(row.clientEmail);
        const leadId = String(row.leadId ?? '').trim() || `HL-EXIST-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

        if (!name && !phone && !email) {
            console.log(`SKIP Row ${rowNo}: empty row`);
            skippedInvalid++;
            continue;
        }

        // De-dupe within the sheet itself
        const sheetKey = phone || email || leadId;
        if (seenInSheet.has(sheetKey)) {
            console.log(`SKIP Row ${rowNo}: "${name}" duplicates an earlier row in the sheet`);
            skippedDuplicate++;
            continue;
        }
        seenInSheet.add(sheetKey);

        // De-dupe against the database (leadId, phone, email) — NEVER overwrite
        const dupOr = [{ leadId }];
        if (phone) dupOr.push({ phoneNumber: phone });
        if (email) dupOr.push({ clientEmail: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
        const existing = await Client.findOne({ $or: dupOr }).select('leadId name phoneNumber clientEmail').lean();
        if (existing) {
            console.log(`SKIP Row ${rowNo}: "${name}" already exists in DB as ${existing.leadId} ("${existing.name}") — existing record untouched`);
            skippedDuplicate++;
            continue;
        }

        // Parse deliverable sets
        let deliverableSets = [];
        const rawSets = String(row.deliverableSets_json ?? '').trim();
        if (rawSets) {
            try {
                const parsed = JSON.parse(rawSets);
                if (Array.isArray(parsed)) deliverableSets = parsed;
            } catch (e) {
                console.log(`   WARN Row ${rowNo}: could not parse deliverableSets_json (${e.message})`);
            }
        }

        const firstSet = deliverableSets[0] || {};
        const shootDates = deliverableSets
            .map(s => s?.shootDate)
            .filter(d => d && !isNaN(new Date(d).getTime()))
            .sort();
        const firstShootDate = shootDates[0] || '';

        const doc = {
            leadId,
            name: name || 'Unknown Client',
            phoneNumber: phone,
            clientEmail: email,
            leadType: 'lead',
            assignedTo: String(row.assignedTo ?? '').trim(),
            status: 'Existing Client',
            isExistingClient: true,
            cost: Number(row.cost || 0),
            remainingAmount: String(row.remainingAmount ?? '0'),
            proposalSent: true,
            proposalAccepted: true,
            proposalSentAt: firstShootDate ? new Date(firstShootDate).toISOString() : new Date().toISOString(),
            deliverableSets,
            servicePitched: String(firstSet.serviceName || 'Podcast').trim(),
            serviceNotes: String(row.serviceNotes ?? '').trim(),
            date: firstShootDate ? toGBDate(firstShootDate) : new Date().toLocaleDateString('en-GB'),
            adRefCode: 'existing-import',
            source: 'Existing Client Import',
            reachoutDone: 'yes',
        };

        if (DRY_RUN) {
            console.log(`DRY  Row ${rowNo}: WOULD import "${doc.name}" (${leadId}) — cost ${doc.cost}, phone: ${doc.phoneNumber || '-'}, email: ${doc.clientEmail || '-'}`);
            created++;
            continue;
        }

        await Client.create(doc);
        console.log(`OK   Row ${rowNo}: imported "${doc.name}" (${leadId}) — cost ${doc.cost}`);
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
