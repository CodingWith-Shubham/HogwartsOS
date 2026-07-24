const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env.local');

function loadEnvFile() {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile();

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1rZQ7OboQX3P83FprGJ7zIqpIjW4oUggIik96JDQzPgU';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const SHEET_CONFIG = [
  { name: 'Clients', range: 'Clients!A2:O' },
  { name: 'Payments', range: 'Payments!A2:K' },
  { name: 'Shoot', range: 'Shoot!A2:AB' },
  { name: 'Editing', range: 'Editing!A2:AG' },
  { name: 'SalesAssignment', range: 'SalesAssignment!A2:E' },
];

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in environment');
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [SHEETS_SCOPE],
  });
}

async function fetchSheetData(sheet) {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheet.range,
  });

  return {
    sheetName: sheet.name,
    rows: response.data.values || [],
  };
}

async function main() {
  const results = [];

  for (const sheet of SHEET_CONFIG) {
    const data = await fetchSheetData(sheet);
    results.push(data);
    console.log(`Fetched ${sheet.name}: ${data.rows.length} rows`);
  }

  const outputPath = path.join(projectRoot, 'tmp-sheets-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`Saved all sheet data to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
