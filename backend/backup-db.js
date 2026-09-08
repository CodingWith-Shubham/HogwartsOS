/**
 * backup-db.js
 * ------------
 * Downloads EVERY collection in the MongoDB database to JSON files so we have
 * a full local backup before performing any migration/import operation.
 *
 * Usage:  node backup-db.js
 * Output: backend/backups/backup-<YYYY-MM-DD_HH-mm-ss>/<collection>.json
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace('T', '_')
    .slice(0, 19);
const backupDir = path.join(__dirname, 'backups', `backup-${timestamp}`);

const run = async () => {
    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI is not set in backend/.env');
        process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    console.log(`✅ Connected. Database: "${db.databaseName}"`);

    fs.mkdirSync(backupDir, { recursive: true });

    const collections = await db.listCollections().toArray();
    console.log(`📚 Found ${collections.length} collections\n`);

    const manifest = {
        database: db.databaseName,
        backedUpAt: new Date().toISOString(),
        backupDir,
        collections: {}
    };

    for (const collInfo of collections) {
        const name = collInfo.name;
        const docs = await db.collection(name).find({}).toArray();
        const filePath = path.join(backupDir, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
        manifest.collections[name] = { documentCount: docs.length, file: `${name}.json` };
        console.log(`   💾 ${name}: ${docs.length} documents -> ${name}.json`);
    }

    fs.writeFileSync(path.join(backupDir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`\n🎉 Backup complete! Files written to:\n   ${backupDir}`);
    await mongoose.disconnect();
    process.exit(0);
};

run().catch(async (err) => {
    console.error('❌ Backup failed:', err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
});
