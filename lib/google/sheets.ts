import { google } from 'googleapis';
import type { CreateLeadInput, EditingProject, Lead, Payment, Shoot } from '@/lib/sheets/types';
import type { InstallmentLabel, PaymentInstallment, PaymentMode } from '@/lib/types';
import { BACKEND_USERS, type BackendUser } from '@/lib/backend-users';
import type { UserRole } from '@/lib/auth';

const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID ??
  '1rZQ7OboQX3P83FprGJ7zIqpIjW4oUggIik96JDQzPgU';

const CLIENTS_SHEET = 'Clients';
const PAYMENTS_SHEET = 'Payments';
const SHOOT_SHEET = 'Shoot';
const EDITING_SHEET = 'Editing';
const EDITING_TASKS_SHEET = 'EditingTasks';
const REVISIONS_SHEET = 'Revisions';
// Clients has 31 columns (A:AE). Keeping both ranges aligned with the whole
// table is essential: Google Sheets uses the supplied range to find the table
// it appends to. A shorter range caused new rows to be appended from column V
// (`teaser_edit`) rather than from column A (`lead_id`).
const CLIENTS_READ_RANGE = `${CLIENTS_SHEET}!A1:AZ`;
const PAYMENTS_READ_RANGE = `${PAYMENTS_SHEET}!A2:Q`;
const PAYMENTS_WITH_HEADERS_READ_RANGE = `${PAYMENTS_SHEET}!A1:Q`;
const SHOOT_READ_RANGE = `${SHOOT_SHEET}!A2:AB`;
const EDITING_READ_RANGE = `${EDITING_SHEET}!A2:AH`;
const EDITING_TASKS_READ_RANGE = `${EDITING_TASKS_SHEET}!A1:Z`;
const REVISIONS_READ_RANGE = `${REVISIONS_SHEET}!A2:J`;

export interface RevisionEntry {
  projectId: string;
  feedback: string;
  timestamp: string;
}

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function parseProposalAccepted(value: string | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === 'true';
}

function rowToLead(
  row: string[],
  index: number,
  salesNotesColumn = -1,
  proposalRevokeReasonColumn = -1
): Lead | null {
  const leadId = row[0]?.trim();
  if (!leadId) return null;

  const name = row[6]?.trim() ?? '';
  const phoneNumber = row[1]?.trim() ?? '';

  return {
    id: leadId,
    leadId,
    phoneNumber,
    date: row[2]?.trim() ?? '',
    adRefCode: row[3]?.trim() ?? '',
    source: row[4]?.trim() ?? '',
    assignedTo: row[5]?.trim() ?? '',
    name,
    reachoutDone: row[7]?.trim() ?? '',
    servicePitched: row[8]?.trim() ?? '',
    cost: row[9]?.trim() ?? '',
    status: row[10]?.trim() ?? '',
    clientEmail: row[11]?.trim() ?? '',
    proposalSent: row[12]?.trim() ?? '',
    proposalAccepted: parseProposalAccepted(row[13]),
    proposalSentAt: row[14]?.trim() ?? '',
    podcastDraft: row[15]?.trim() ?? '',
    podcastEdit: row[16]?.trim() ?? '',
    reelDraft: row[17]?.trim() ?? '',
    reelEdit: row[18]?.trim() ?? '',
    longFormatVideo: row[19]?.trim() ?? '',
    // Column 20 is intentionally blank in the Clients tab. The sheet then has
    // `teaser_edit` and `thumbnail_edit`, not separate
    // teaser-demo/final-teaser columns. Keep the legacy aliases populated for
    // existing dashboards while exposing the actual sheet fields as well.
    teaserEdit: row[21]?.trim() ?? '',
    teaserDemo: row[21]?.trim() ?? '',
    teaser: row[21]?.trim() ?? '',
    thumbnailEdit: row[22]?.trim() ?? '',
    thumbnail: row[22]?.trim() ?? '',
    serviceNotes: row[23]?.trim() ?? '',
    camera: row[24]?.trim() ?? '',
    recordTime: row[25]?.trim() ?? '',
    studioTime: row[26]?.trim() ?? '',
    remainingAmount: row[27]?.trim() ?? '',
    shortFormatVideo: row[28]?.trim() ?? '',
    longFormatDuration: row[29]?.trim() ?? '',
    shortFormatDuration: row[30]?.trim() ?? '',
    additionalNotes: '',
    salesNotes: salesNotesColumn >= 0 ? row[salesNotesColumn]?.trim() ?? '' : '',
    proposalRevokeReason:
      proposalRevokeReasonColumn >= 0 ? row[proposalRevokeReasonColumn]?.trim() ?? '' : '',
    serialNo: index + 1,
    searchText: `${name} ${phoneNumber}`.toLowerCase(),
    payment: null,
  };
}

function rowToPayment(row: string[]): Payment | null {
  const leadId = row[1]?.trim();
  if (!leadId) return null;

  return {
    paymentId: row[0]?.trim() ?? '',
    leadId,
    clientName: row[2]?.trim() ?? '',
    amount: row[3]?.trim() ?? '',
    paymentLinkSent: row[4]?.trim() ?? '',
    paymentLinkSentAt: row[5]?.trim() ?? '',
    screenshotUrl: row[6]?.trim() ?? '',
    utrNumber: row[7]?.trim() ?? '',
    paymentStatus: row[8]?.trim() ?? '',
    verifiedBy: row[9]?.trim() ?? '',
    verifiedAt: row[10]?.trim() ?? '',
  };
}

function rowToShoot(row: string[]): Shoot | null {
  const shootId = row[0]?.trim();
  const leadId = row[1]?.trim();

  if (!shootId && !leadId) return null;

  const id = shootId || leadId;
  const clientName = row[2]?.trim() ?? '';
  const contactNum = row[3]?.trim() ?? '';

  return {
    id,
    shootId: shootId || leadId,
    leadId,
    clientName,
    contactNum,
    emailId: row[4]?.trim() ?? '',
    shootDate: row[5]?.trim() ?? '',
    shootStartTime: row[6]?.trim() ?? '',
    shootEndTime: row[7]?.trim() ?? '',
    camera: row[8]?.trim() ?? '',
    teleprompter: row[9]?.trim() ?? '',
    totalHours: row[10]?.trim() ?? '',
    assignedTo: row[11]?.trim() ?? '',
    bts: row[12]?.trim() ?? '',
    shootMemberName: row[13]?.trim() ?? '',
    shootMemberEmail: row[14]?.trim() ?? '',
    dataLink: row[15]?.trim() ?? '',
    driveLinkUploaded: row[16]?.trim() ?? 'false',
    createdAt: row[17]?.trim() ?? '',
    testimonials: row[18]?.trim() ?? '',
    recordTime: row[19]?.trim() ?? '',
    studioTime: row[20]?.trim() ?? '',
    extraCamera: row[21]?.trim() ?? '',
    extraTeleprompter: row[22]?.trim() ?? '',
    extraDurationHours: row[23]?.trim() ?? '',
    additionalCost: row[24]?.trim() ?? '',
    shootNotes: row[25]?.trim() ?? '',
    editedByShootTeam: row[26]?.trim() ?? 'false',
    searchText: `${clientName} ${contactNum} ${leadId}`.toLowerCase(),
  };
}

function parseNumber(value: string | undefined, fallback = 0): number {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined): boolean {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function rowToEditingProject(row: string[]): EditingProject | null {
  const editId = row[0]?.trim();
  const shootId = row[1]?.trim();
  const leadId = row[2]?.trim();

  if (!editId && !shootId && !leadId) return null;

  const id = editId || shootId || leadId;
  const clientName = row[3]?.trim() ?? '';
  const editorName = row[20]?.trim() ?? '';
  const serviceType = row[22]?.trim() ?? '';

  return {
    id,
    editId: editId || id,
    shootId,
    leadId,
    clientName,
    month: row[4]?.trim() ?? '',
    editStartDate: row[5]?.trim() ?? '',
    editDeliveryDate: row[6]?.trim() ?? '',
    podcastDraft: row[7]?.trim() ?? '',
    podcastEdit: row[8]?.trim() ?? '',
    longFormatVideo: row[9]?.trim() ?? '',
    reelDraft: row[10]?.trim() ?? '',
    reel: row[11]?.trim() ?? '',
    teaserDemo: row[12]?.trim() ?? '',
    teaser: row[13]?.trim() ?? '',
    thumbnail: row[14]?.trim() ?? '',
    dataLink: row[15]?.trim() ?? '',
    status: row[16]?.trim() ?? '',
    totalService: row[17]?.trim() ?? '',
    emailId: row[18]?.trim() ?? '',
    handoverToClient: row[19]?.trim() ?? '',
    editorName,
    editorEmail: row[21]?.trim() ?? '',
    serviceType,
    revisionCount: parseNumber(row[23]),
    maxFreeRevisions: parseNumber(row[24], 2),
    extraRevisionApproved: parseBoolean(row[25]),
    extraRevisionCost: row[26]?.trim() ?? '',
    currentDraftLink: row[27]?.trim() ?? '',
    assignedAt: row[28]?.trim() ?? '',
    deadlineAt: row[29]?.trim() ?? '',
    deadlineNotified: row[30]?.trim() ?? '',
    finalDelivered: parseBoolean(row[31]),
    searchText: `${clientName} ${editorName} ${serviceType} ${leadId}`.toLowerCase(),
  };
}

function rowToRevisionEntry(row: string[]): RevisionEntry | null {
  const projectId = row[0]?.trim();
  if (!projectId) return null;

  return {
    projectId,
    feedback: row[4]?.trim() ?? '',
    timestamp: row[9]?.trim() ?? '',
  };
}

function joinLeadsWithPayments(leads: Lead[], payments: Payment[]): Lead[] {
  const paymentByLeadId = new Map<string, Payment>();
  for (const payment of payments) {
    paymentByLeadId.set(payment.leadId, payment);
  }

  return leads.map((lead) => {
    const payment = paymentByLeadId.get(lead.leadId) ?? null;
    const payment_status = payment?.paymentStatus?.trim() || undefined;

    return {
      ...lead,
      payment,
      payment_status,
    };
  });
}

function sortLeadsNewestFirst(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => b.serialNo - a.serialNo);
}

function getAuthClient() {
  const email =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ??
    'hogwarts-automation@hogwarts-automation.iam.gserviceaccount.com';
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!privateKey) {
    throw new Error(
      'GOOGLE_PRIVATE_KEY is not configured. Add your service account private key to .env.local'
    );
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [SHEETS_SCOPE],
  });
}

function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

function generateLeadId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HL-${timestamp}-${random}`;
}

function formatLeadDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function buildLeadRow(input: CreateLeadInput, leadId: string): string[] {
  return [
    leadId,
    input.phoneNumber.trim(),
    formatLeadDate(new Date()),
    input.whatsapp?.trim() ?? '',
    'Manual Entry',
    input.assignedTo.trim(),
    input.name.trim(),
    input.reachoutDone,
    input.servicePitched.trim(),
    input.cost?.trim() ?? '',
    'New Lead',
    input.clientEmail?.trim() ?? '',
    'false',
    'false',
    '',
    input.podcastDraft?.trim() ?? '',
    input.podcastEdit?.trim() ?? '',
    input.reelDraft?.trim() ?? '',
    input.reelEdit?.trim() ?? '',
    input.longFormatVideo?.trim() ?? '',
    '',
    input.teaserEdit?.trim() ?? input.teaser?.trim() ?? input.teaserDemo?.trim() ?? '',
    input.thumbnailEdit?.trim() ?? input.thumbnail?.trim() ?? '',
    input.serviceNotes?.trim() ?? '',
    input.camera?.trim() ?? '',
    input.recordTime?.trim() ?? '',
    input.studioTime?.trim() ?? '',
    input.remainingAmount?.trim() ?? '',
    input.shortFormatVideo?.trim() ?? '',
    input.longFormatDuration?.trim() ?? '',
    input.shortFormatDuration?.trim() ?? '',
    input.salesNotes?.trim() ?? '',
    '',
  ];
}

export interface EditingTask {
  task_id: string;
  edit_id: string;
  shoot_id: string;
  lead_id: string;
  client_name: string;
  service_type: string;
  task_type: string;
  task_index: string;
  task_label: string;
  data_link: string;
  assigned_to_name: string;
  assigned_to_email: string;
  status: string;
  draft_link: string;
  manager_comment: string;
  revision_count: string;
  deadline_at: string;
  final_delivered: string;
  allocation_history: string;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function paymentColumn(headers: string[], names: string[], fallback: number): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  const index = names.map(normalizeHeader).map((name) => normalizedHeaders.indexOf(name)).find((value) => value >= 0);
  return index ?? fallback;
}

function paymentValue(row: string[], index: number): string {
  return row[index]?.trim() ?? '';
}

function toPaymentMode(value: string): PaymentMode {
  return value.trim().toLowerCase() === 'cash' ? 'Cash' : 'Online';
}

function toInstallmentLabel(value: string): InstallmentLabel {
  const labels: InstallmentLabel[] = ['Advance', 'Day Before Shoot', 'Post Shoot', 'Custom'];
  return labels.find((label) => label.toLowerCase() === value.trim().toLowerCase()) ?? 'Advance';
}

function rowToPaymentInstallment(row: string[], headers: string[]): PaymentInstallment | null {
  const leadId = paymentValue(row, paymentColumn(headers, ['lead_id', 'lead id'], 1));
  if (!leadId) return null;

  const amount = parseNumber(paymentValue(row, paymentColumn(headers, ['amount', 'amount_to_collect'], 3)));
  const status = paymentValue(row, paymentColumn(headers, ['payment_status', 'status'], 8));
  const verifiedAt = paymentValue(row, paymentColumn(headers, ['verified_at'], 10));

  return {
    payment_id: paymentValue(row, paymentColumn(headers, ['payment_id', 'payment id'], 0)),
    lead_id: leadId,
    client_name: paymentValue(row, paymentColumn(headers, ['client_name', 'client name'], 2)),
    installment_label: toInstallmentLabel(paymentValue(row, paymentColumn(headers, ['installment_label', 'installment label'], 13))),
    amount,
    payment_mode: toPaymentMode(paymentValue(row, paymentColumn(headers, ['payment_mode', 'payment mode'], 11))),
    cash_collected_by: paymentValue(row, paymentColumn(headers, ['cash_collected_by', 'cash collected by'], 12)) || undefined,
    payment_status: status,
    payment_link_sent_at: paymentValue(row, paymentColumn(headers, ['payment_link_sent_at', 'payment link sent at'], 5)) || undefined,
    verified_at: verifiedAt || undefined,
    total_cost: parseNumber(paymentValue(row, paymentColumn(headers, ['total_cost', 'total cost'], 14))),
    remaining_amount: parseNumber(paymentValue(row, paymentColumn(headers, ['remaining_amount', 'remaining amount'], 15))),
    payment_completed:
      parseBoolean(paymentValue(row, paymentColumn(headers, ['payment_completed', 'payment completed'], 16))) ||
      ['payment verified', 'payment confirmed', 'confirmed'].includes(status.toLowerCase()),
  };
}

// --- CACHING & REQUEST COALESCING CONFIG ---
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In Next.js hot-reloads, global scope might be re-initialized.
// Using globalThis ensures the cache persists across fast-refreshes in development.
const globalWithCache = globalThis as typeof globalThis & {
  sheetsCache?: Map<string, CacheEntry<any>>;
  sheetsActiveRequests?: Map<string, Promise<any>>;
};

if (!globalWithCache.sheetsCache) {
  globalWithCache.sheetsCache = new Map();
}
if (!globalWithCache.sheetsActiveRequests) {
  globalWithCache.sheetsActiveRequests = new Map();
}

const sheetsCache = globalWithCache.sheetsCache;
const sheetsActiveRequests = globalWithCache.sheetsActiveRequests;
const CACHE_TTL_MS = 5000; // 5 seconds TTL

export function clearSheetsCache() {
  sheetsCache.clear();
  sheetsActiveRequests.clear();
}

async function getCachedData<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = sheetsCache.get(key);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  let activePromise = sheetsActiveRequests.get(key);
  if (!activePromise) {
    activePromise = fetchFn()
      .then((data) => {
        sheetsCache.set(key, { data, timestamp: Date.now() });
        sheetsActiveRequests.delete(key);
        return data;
      })
      .catch((err) => {
        sheetsActiveRequests.delete(key);
        throw err;
      });
    sheetsActiveRequests.set(key, activePromise);
  }

  return activePromise;
}

export async function fetchPaymentsFromSheet(): Promise<Payment[]> {
  try {
    return await getCachedData('payments', async () => {
      const sheets = getSheetsClient();

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: PAYMENTS_READ_RANGE,
      });

      const rows = response.data.values ?? [];

      return rows
        .map((row) => rowToPayment(row as string[]))
        .filter((payment): payment is Payment => payment !== null);
    });
  } catch (error) {
    console.error('Failed to fetch payments from Google Sheets:', error);
    return [];
  }
}

export async function fetchShootsFromSheet(): Promise<Shoot[]> {
  return getCachedData('shoots', async () => {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHOOT_READ_RANGE,
    });

    const rows = response.data.values ?? [];

    return rows
      .map((row) => rowToShoot(row as string[]))
      .filter((shoot): shoot is Shoot => shoot !== null);
  });
}

export async function fetchEditingFromSheet(): Promise<EditingProject[]> {
  return getCachedData('editing', async () => {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: EDITING_READ_RANGE,
    });

    const rows = response.data.values ?? [];

    return rows
      .map((row) => rowToEditingProject(row as string[]))
      .filter((project): project is EditingProject => project !== null);
  });
}

function taskFromRow(row: string[], headers: string[]): EditingTask | null {
  const values = Object.fromEntries(headers.map((header, index) => [header.trim().toLowerCase(), row[index]?.trim() ?? '']));
  const taskId = values.task_id;
  if (!taskId) return null;

  return {
    task_id: taskId,
    edit_id: values.edit_id ?? '', shoot_id: values.shoot_id ?? '', lead_id: values.lead_id ?? '',
    client_name: values.client_name ?? '', service_type: values.service_type ?? '',
    task_type: values.task_type ?? '', task_index: values.task_index ?? '', task_label: values.task_label ?? '',
    data_link: values.data_link ?? '', assigned_to_name: values.assigned_to_name ?? '',
    assigned_to_email: values.assigned_to_email ?? '', status: values.status ?? 'Assigned',
    draft_link: values.draft_link ?? '', manager_comment: values.manager_comment ?? '',
    revision_count: values.revision_count ?? '', deadline_at: values.deadline_at ?? '',
    final_delivered: values.final_delivered ?? '', allocation_history: values.allocation_history ?? '',
  };
}

export async function fetchEditingTasksFromSheet(email?: string): Promise<EditingTask[]> {
  return getCachedData(`editing-tasks:${email?.toLowerCase() ?? 'all'}`, async () => {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: EDITING_TASKS_READ_RANGE });
    const [headers = [], ...rows] = response.data.values ?? [];
    const tasks = rows.map((row) => taskFromRow(row as string[], headers as string[])).filter((task): task is EditingTask => task !== null);
    const normalizedEmail = email?.trim().toLowerCase();
    return normalizedEmail ? tasks.filter((task) => task.assigned_to_email.toLowerCase() === normalizedEmail) : tasks;
  });
}

export async function updateEditingTaskInSheet(taskId: string, updates: { status: string; draft_link?: string }): Promise<EditingTask | null> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: EDITING_TASKS_READ_RANGE });
  const [headers = [], ...rows] = response.data.values ?? [];
  const normalizedHeaders = (headers as string[]).map((header) => header.trim().toLowerCase());
  const taskIdColumn = normalizedHeaders.indexOf('task_id');
  const statusColumn = normalizedHeaders.indexOf('status');
  const draftLinkColumn = normalizedHeaders.indexOf('draft_link');
  const rowIndex = rows.findIndex((row) => (row as string[])[taskIdColumn]?.trim() === taskId);
  if (taskIdColumn < 0 || statusColumn < 0 || rowIndex < 0) return null;

  const row = [...(rows[rowIndex] as string[])];
  while (row.length < normalizedHeaders.length) row.push('');
  row[statusColumn] = updates.status;
  if (updates.draft_link !== undefined && draftLinkColumn >= 0) row[draftLinkColumn] = updates.draft_link;
  const rowNumber = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${EDITING_TASKS_SHEET}!A${rowNumber}:${String.fromCharCode(64 + normalizedHeaders.length)}${rowNumber}`,
    valueInputOption: 'USER_ENTERED', requestBody: { values: [row] },
  });
  clearSheetsCache();
  return taskFromRow(row, headers as string[]);
}

export async function fetchRevisionsFromSheet(): Promise<RevisionEntry[]> {
  return getCachedData('revisions', async () => {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: REVISIONS_READ_RANGE,
    });

    const rows = response.data.values ?? [];

    return rows
      .map((row) => rowToRevisionEntry(row as string[]))
      .filter((revision): revision is RevisionEntry => revision !== null);
  });
}

export async function fetchLeadsWithPayments(): Promise<Lead[]> {
  const [leads, payments] = await Promise.all([
    fetchClientsFromSheet(),
    fetchPaymentsFromSheet(),
  ]);

  return sortLeadsNewestFirst(joinLeadsWithPayments(leads, payments));
}

export async function fetchClientsFromSheet(): Promise<Lead[]> {
  return getCachedData('clients', async () => {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: CLIENTS_READ_RANGE,
    });

    const [headers = [], ...rows] = response.data.values ?? [];
    const salesNotesColumn = (headers as string[]).findIndex(
      (header) => header.trim().toLowerCase() === 'sales_notes'
    );
    const proposalRevokeReasonColumn = (headers as string[]).findIndex(
      (header) => header.trim().toLowerCase() === 'proposal_revoke_reason'
    );

    return rows
      .map((row, index) =>
        rowToLead(row as string[], index, salesNotesColumn, proposalRevokeReasonColumn)
      )
      .filter((lead): lead is Lead => lead !== null);
  });
}

export async function fetchPaymentInstallmentsFromSheet(leadId?: string): Promise<PaymentInstallment[]> {
  try {
    const installments = await getCachedData('payment_installments', async () => {
      const sheets = getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: PAYMENTS_WITH_HEADERS_READ_RANGE,
      });
      const [headers = [], ...rows] = response.data.values ?? [];
      return rows
        .map((row) => rowToPaymentInstallment(row as string[], headers as string[]))
        .filter((payment): payment is PaymentInstallment => payment !== null);
    });

    return leadId ? installments.filter((payment) => payment.lead_id === leadId) : installments;
  } catch (error) {
    console.error('Failed to fetch payment installments from Google Sheets:', error);
    return [];
  }
}

async function getNextClientRow(sheets: ReturnType<typeof getSheetsClient>): Promise<number> {
  // Do not use values.append here. Google Sheets infers a "table" from the
  // contiguous filled cells, and the old malformed rows start at column V.
  // Reading the complete grid gives us the real last occupied row instead.
  // buildLeadRow produces 33 columns (A:AG), so read the full width.
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CLIENTS_SHEET}!A:AG`,
  });

  // Row 1 is the header. `values` retains rows up to the last row that has a
  // value anywhere in A:AG, including rows whose first populated cell is V.
  return Math.max((response.data.values ?? []).length + 1, 2);
}

export async function appendClientToSheet(input: CreateLeadInput): Promise<Lead> {
  const sheets = getSheetsClient();
  const leadId = generateLeadId();
  const row = buildLeadRow(input, leadId);
  const nextRow = await getNextClientRow(sheets);

  // Write to a fully-qualified row, starting at A. This deliberately bypasses
  // the append endpoint's table-detection behaviour.
  // buildLeadRow produces 33 columns (A:AG) — range must cover all of them.
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CLIENTS_SHEET}!A${nextRow}:AG${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row],
    },
  });

  // Clear cache to ensure updated sheet content is retrieved
  clearSheetsCache();

  const existingLeads = await fetchLeadsWithPayments();
  const createdLead = existingLeads.find((lead) => lead.leadId === leadId);

  if (createdLead) {
    return createdLead;
  }

  return {
    id: leadId,
    leadId,
    phoneNumber: input.phoneNumber.trim(),
    date: row[2],
    adRefCode: row[3],
    source: row[4],
    assignedTo: input.assignedTo.trim(),
    name: input.name.trim(),
    reachoutDone: input.reachoutDone,
    servicePitched: input.servicePitched.trim(),
    cost: input.cost?.trim() ?? '',
    status: 'New Lead',
    clientEmail: input.clientEmail?.trim() ?? '',
    proposalSent: 'false',
    proposalAccepted: false,
    proposalSentAt: '',
    podcastDraft: input.podcastDraft?.trim() ?? '',
    podcastEdit: input.podcastEdit?.trim() ?? '',
    reelDraft: input.reelDraft?.trim() ?? '',
    reelEdit: input.reelEdit?.trim() ?? '',
    longFormatVideo: input.longFormatVideo?.trim() ?? '',
    teaserEdit: input.teaserEdit?.trim() ?? input.teaser?.trim() ?? input.teaserDemo?.trim() ?? '',
    teaserDemo: input.teaserEdit?.trim() ?? input.teaser?.trim() ?? input.teaserDemo?.trim() ?? '',
    teaser: input.teaserEdit?.trim() ?? input.teaser?.trim() ?? input.teaserDemo?.trim() ?? '',
    thumbnailEdit: input.thumbnailEdit?.trim() ?? input.thumbnail?.trim() ?? '',
    thumbnail: input.thumbnailEdit?.trim() ?? input.thumbnail?.trim() ?? '',
    serviceNotes: input.serviceNotes?.trim() ?? '',
    camera: input.camera?.trim() ?? '',
    recordTime: input.recordTime?.trim() ?? '',
    studioTime: input.studioTime?.trim() ?? '',
    remainingAmount: input.remainingAmount?.trim() ?? '',
    shortFormatVideo: input.shortFormatVideo?.trim() ?? '',
    longFormatDuration: input.longFormatDuration?.trim() ?? '',
    shortFormatDuration: input.shortFormatDuration?.trim() ?? '',
    additionalNotes: input.additionalNotes?.trim() ?? '',
    salesNotes: input.salesNotes?.trim() ?? '',
    proposalRevokeReason: '',
    serialNo: existingLeads.length + 1,
    searchText: `${input.name.trim()} ${input.phoneNumber.trim()}`.toLowerCase(),
    payment: null,
  };
}

function findUserColumn(headers: string[], names: string[], fallback: number): number {
  const normalized = headers.map(h => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));
  const targetNames = names.map(n => n.trim().toLowerCase().replace(/[\s_-]+/g, ''));
  const index = targetNames.map(name => normalized.indexOf(name)).find(idx => idx >= 0);
  return index ?? fallback;
}

export async function fetchBackendUsersFromSheet(): Promise<BackendUser[]> {
  return getCachedData('backend_users', async () => {
    try {
      const sheets = getSheetsClient();
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });
      const sheetExists = spreadsheet.data.sheets?.some(
        (s) => s.properties?.title === 'Users'
      );

      if (!sheetExists) {
        // Create the Users sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Users',
                  },
                },
              },
            ],
          },
        });

        // Populate it with headers and default users
        const headers = ['id', 'name', 'email', 'phone', 'designation', 'role', 'initials', 'username', 'redirectTo', 'password'];
        const defaultRows = BACKEND_USERS.map((user) => [
          user.id,
          user.name,
          user.email,
          user.phone,
          user.designation,
          user.role,
          user.initials,
          user.username,
          user.redirectTo,
          user.password || '',
        ]);

        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Users!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [headers, ...defaultRows],
          },
        });

        return BACKEND_USERS;
      }

      // Read headers and data dynamically
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Users!A1:L',
      });

      const [headers = [], ...rows] = response.data.values ?? [];
      
      const idCol = findUserColumn(headers as string[], ['id', 'user_id', 'userid'], 0);
      const nameCol = findUserColumn(headers as string[], ['name', 'full_name', 'fullname'], 1);
      const emailCol = findUserColumn(headers as string[], ['email', 'email_address', 'emailaddress'], 2);
      const phoneCol = findUserColumn(headers as string[], ['phone', 'phone_number', 'phonenumber', 'contact'], 3);
      const designationCol = findUserColumn(headers as string[], ['designation', 'title', 'role_title'], 4);
      const roleCol = findUserColumn(headers as string[], ['role', 'user_role'], 5);
      const initialsCol = findUserColumn(headers as string[], ['initials'], -1);
      const usernameCol = findUserColumn(headers as string[], ['username', 'user_name'], 7);
      const redirectToCol = findUserColumn(headers as string[], ['redirectto', 'redirect_to', 'redirect'], 8);
      const passwordCol = findUserColumn(headers as string[], ['password', 'pwd'], 9);

      return rows
        .map((row) => {
          const id = row[idCol]?.trim() ?? '';
          const name = row[nameCol]?.trim() ?? '';
          const email = row[emailCol]?.trim() ?? '';
          const phone = row[phoneCol]?.trim() ?? '';
          const designation = row[designationCol]?.trim() ?? '';
          const role = (row[roleCol]?.trim() ?? 'sales') as UserRole;
          
          let initials = initialsCol >= 0 && row[initialsCol] ? row[initialsCol].trim() : '';
          if (!initials && name) {
            initials = name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
          }

          const username = row[usernameCol]?.trim() ?? '';
          const redirectTo = row[redirectToCol]?.trim() ?? '';
          const password = row[passwordCol]?.trim() ?? '';

          return {
            id,
            name,
            email,
            phone,
            designation,
            role,
            initials,
            username,
            redirectTo,
            password,
          };
        })
        .filter((u) => u.id)
        // Keep the configured editor contact address consistent even when an
        // older Users sheet still contains the previous studio aliases.
        .map((u) =>
          u.role === 'editor' && ['Shubham Singh Rana', 'Deepak Sharma'].includes(u.name)
            ? { ...u, email: 'mamgai75@gmail.com' }
            : u
        );
    } catch (err) {
      console.error('Failed to fetch backend users from Google Sheets:', err);
      return BACKEND_USERS;
    }
  });
}

export async function updateBackendUserInSheet(
  id: string,
  data: Partial<BackendUser>
): Promise<boolean> {
  try {
    const users = await fetchBackendUsersFromSheet();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return false;

    const user = users[index];
    if (data.name !== undefined) user.name = data.name.trim();
    if (data.email !== undefined) user.email = data.email.trim();
    if (data.phone !== undefined) user.phone = data.phone.trim();
    if (data.designation !== undefined) user.designation = data.designation.trim();
    if (data.role !== undefined) user.role = data.role;
    if (data.username !== undefined) user.username = data.username.trim().toLowerCase();
    if (data.redirectTo !== undefined) user.redirectTo = data.redirectTo.trim();
    if (data.password !== undefined) user.password = data.password.trim();

    if (data.name !== undefined) {
      user.initials = user.name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    }
    if (data.initials !== undefined) user.initials = data.initials.trim();

    const sheets = getSheetsClient();
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A1:L1',
    });
    const headers = headerResponse.data.values?.[0] ?? [];

    const row = headers.map((header) => {
      const h = header.trim().toLowerCase().replace(/[\s_-]+/g, '');
      if (['id', 'user_id', 'userid'].includes(h)) return user.id;
      if (['name', 'full_name', 'fullname'].includes(h)) return user.name;
      if (['email', 'email_address', 'emailaddress'].includes(h)) return user.email;
      if (['phone', 'phone_number', 'phonenumber', 'contact'].includes(h)) return user.phone;
      if (['designation', 'title', 'role_title'].includes(h)) return user.designation;
      if (['role', 'user_role'].includes(h)) return user.role;
      if (['initials'].includes(h)) return user.initials;
      if (['username', 'user_name'].includes(h)) return user.username;
      if (['redirectto', 'redirect_to', 'redirect'].includes(h)) return user.redirectTo;
      if (['password', 'pwd'].includes(h)) return user.password || '';
      return '';
    });

    const rowNumber = index + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Users!A${rowNumber}:${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    clearSheetsCache();
    return true;
  } catch (err) {
    console.error('Failed to update backend user in Google Sheets:', err);
    return false;
  }
}

export async function appendBackendUserToSheet(input: Omit<BackendUser, 'id' | 'initials'>): Promise<BackendUser> {
  const users = await fetchBackendUsersFromSheet();
  const nextId = 'u' + (users.length + 1);
  const initials = input.name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const newUser: BackendUser = {
    id: nextId,
    initials,
    ...input,
  };

  const sheets = getSheetsClient();
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Users!A1:L1',
  });
  const headers = headerResponse.data.values?.[0] ?? [];

  const row = headers.map((header) => {
    const h = header.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (['id', 'user_id', 'userid'].includes(h)) return newUser.id;
    if (['name', 'full_name', 'fullname'].includes(h)) return newUser.name;
    if (['email', 'email_address', 'emailaddress'].includes(h)) return newUser.email;
    if (['phone', 'phone_number', 'phonenumber', 'contact'].includes(h)) return newUser.phone;
    if (['designation', 'title', 'role_title'].includes(h)) return newUser.designation;
    if (['role', 'user_role'].includes(h)) return newUser.role;
    if (['initials'].includes(h)) return newUser.initials;
    if (['username', 'user_name'].includes(h)) return newUser.username;
    if (['redirectto', 'redirect_to', 'redirect'].includes(h)) return newUser.redirectTo;
    if (['password', 'pwd'].includes(h)) return newUser.password || '';
    return '';
  });

  const nextRow = users.length + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Users!A${nextRow}:${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row],
    },
  });

  clearSheetsCache();
  return newUser;
}

export async function updateClientInSheet(leadId: string, input: Partial<CreateLeadInput> & { status?: string }): Promise<boolean> {
  try {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CLIENTS_SHEET}!A2:A`,
    });

    const rows = response.data.values ?? [];
    const index = rows.findIndex((row) => row[0]?.trim() === leadId);
    if (index === -1) return false;

    const rowNumber = index + 2;

    const rowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CLIENTS_SHEET}!A${rowNumber}:AE${rowNumber}`,
    });

    const fullRow = rowResponse.data.values?.[0] ?? [];

    while (fullRow.length < 31) {
      fullRow.push('');
    }

    if (input.name !== undefined) fullRow[6] = input.name.trim();
    if (input.phoneNumber !== undefined) fullRow[1] = input.phoneNumber.trim();
    if (input.whatsapp !== undefined) fullRow[3] = input.whatsapp.trim();
    if (input.servicePitched !== undefined) fullRow[8] = input.servicePitched.trim();
    if (input.clientEmail !== undefined) fullRow[11] = input.clientEmail.trim();
    if (input.cost !== undefined) fullRow[9] = input.cost.trim();
    if (input.assignedTo !== undefined) fullRow[5] = input.assignedTo.trim();
    if (input.status !== undefined) fullRow[10] = input.status.trim();

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CLIENTS_SHEET}!A${rowNumber}:AE${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [fullRow],
      },
    });

    clearSheetsCache();
    return true;
  } catch (err) {
    console.error('Failed to update client in Google Sheets:', err);
    return false;
  }
}
