require('tsx/cjs');

const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { PrismaPg } = require('@prisma/adapter-pg');

const prismaClientModule = (() => {
  try {
    return require('@prisma/client');
  } catch (error) {
    return require('../node_modules/.prisma/client/client.ts');
  }
})();

const { PrismaClient, Prisma } = prismaClientModule;

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const datasetPath = resolveDatasetPath();

let prisma;

function resolveDatasetPath() {
  const candidates = [...new Set([
    path.join(__dirname, 'donor_thank_you_synthetic_seed_data.json'),
    path.join(__dirname, '..', 'donor_thank_you_synthetic_seed_data.json'),
    path.join(__dirname, '..', '..', 'donor_thank_you_synthetic_seed_data.json'),
    path.join(process.cwd(), 'donor_thank_you_synthetic_seed_data.json'),
    path.join(process.cwd(), 'prisma', 'donor_thank_you_synthetic_seed_data.json'),
  ])];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    [
      'Seed dataset not found.',
      'Expected donor_thank_you_synthetic_seed_data.json in one of these locations:',
      ...candidates.map((candidate) => `- ${candidate}`),
    ].join('\n'),
  );
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for seeding');
  }

  const normalizedUrl = new URL(connectionString);
  normalizedUrl.searchParams.delete('sslmode');
  normalizedUrl.searchParams.delete('connect_timeout');
  normalizedUrl.searchParams.delete('pgbouncer');

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: normalizedUrl.toString(),
      ssl: {
        rejectUnauthorized: false,
      },
    }),
  });
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function pickValue(record, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined) {
      return record[key];
    }
  }

  return undefined;
}

function toOptionalText(value) {
  if (!hasValue(value)) {
    return null;
  }

  const text = String(value).trim();

  if (!text || ['null', 'undefined'].includes(text.toLowerCase())) {
    return null;
  }

  return text;
}

function toRequiredText(value, fieldName) {
  const text = toOptionalText(value);

  if (!text) {
    throw new Error(`Missing required ${fieldName}`);
  }

  return text;
}

function splitFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: 'Unknown', lastName: 'Donor' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Donor' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => toOptionalText(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[|,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeEnum(value, allowedValues, fallback) {
  if (!hasValue(value)) {
    return fallback;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return allowedValues.includes(normalized) ? normalized : fallback;
}

function toBoolean(value) {
  if (!hasValue(value)) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return null;
}

function toInteger(value, fieldName) {
  if (!hasValue(value)) {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for ${fieldName}`);
  }

  return parsed;
}

function toDecimal(value, fieldName) {
  if (!hasValue(value)) {
    throw new Error(`Missing required ${fieldName}`);
  }

  const decimalValue = new Prisma.Decimal(String(value));

  if (decimalValue.isNaN()) {
    throw new Error(`Invalid decimal for ${fieldName}`);
  }

  return decimalValue;
}

function toDateOnly(value, fieldName, required = false) {
  if (!hasValue(value)) {
    if (required) {
      throw new Error(`Missing required ${fieldName}`);
    }

    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid date for ${fieldName}`);
    }

    return value;
  }

  if (typeof value === 'number') {
    const numericDate = new Date(value);

    if (Number.isNaN(numericDate.getTime())) {
      throw new Error(`Invalid date for ${fieldName}`);
    }

    return numericDate;
  }

  const text = String(value).trim();

  if (!text) {
    if (required) {
      throw new Error(`Missing required ${fieldName}`);
    }

    return null;
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00.000Z`)
    : new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date for ${fieldName}`);
  }

  return date;
}

function extractCollection(source, keys) {
  if (!source || typeof source !== 'object') {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(source[key])) {
      return source[key];
    }
  }

  return [];
}

function normalizeDataset(rawDataset) {
  if (!rawDataset || typeof rawDataset !== 'object' || Array.isArray(rawDataset)) {
    throw new Error('Seed dataset must be a JSON object with donors and donations arrays.');
  }

  const donors = extractCollection(rawDataset, [
    'donors',
    'donorRecords',
    'donor_records',
    'seedDonors',
    'seed_donors',
  ]);

  const donations = extractCollection(rawDataset, [
    'donations',
    'donationRecords',
    'donation_records',
    'seedDonations',
    'seed_donations',
  ]);

  if (donors.length === 0 || donations.length === 0) {
    throw new Error('Seed dataset must include both donors and donations arrays.');
  }

  return { donors, donations };
}

function buildDonorData(record) {
  const donorCode = toOptionalText(pickValue(record, ['donor_code', 'donorCode', 'code']));
  const explicitFirstName = toOptionalText(pickValue(record, ['first_name', 'firstName']));
  const explicitLastName = toOptionalText(pickValue(record, ['last_name', 'lastName']));
  const explicitFullName = toOptionalText(pickValue(record, ['full_name', 'fullName', 'name', 'donor_name']));
  const fallbackName = splitFullName(explicitFullName || `${explicitFirstName || ''} ${explicitLastName || ''}`.trim());

  const donorData = {
    first_name: explicitFirstName || fallbackName.firstName,
    last_name: explicitLastName || fallbackName.lastName,
    email: toRequiredText(pickValue(record, ['email', 'donor_email', 'donorEmail']), 'donor email'),
    campaign_history: normalizeStringArray(pickValue(record, ['campaign_history', 'campaignHistory'])),
    tags: normalizeStringArray(pickValue(record, ['tags'])),
  };

  if (donorCode) {
    donorData.donor_code = donorCode;
  }

  const optionalTextFields = [
    ['phone', 'phone'],
    ['address_line_1', 'addressLine1'],
    ['city', 'city'],
    ['state', 'state'],
    ['country', 'country'],
    ['postal_code', 'postalCode'],
    ['stewardship_notes', 'stewardshipNotes'],
  ];

  for (const [fieldName, key] of optionalTextFields) {
    const value = toOptionalText(pickValue(record, [key]));

    if (value) {
      donorData[fieldName] = value;
    }
  }

  donorData.donor_type = toOptionalText(pickValue(record, ['donor_type', 'donorType'])) || 'unknown';

  const recurringStatus = pickValue(record, ['recurring_status', 'recurringStatus', 'is_recurring', 'isRecurring']);

  if (recurringStatus !== undefined) {
    donorData.recurring_status = recurringStatus;
  }

  const lifetimeGiving = pickValue(record, ['lifetime_giving', 'lifetimeGiving']);

  if (hasValue(lifetimeGiving)) {
    donorData.lifetime_giving = toDecimal(lifetimeGiving, 'lifetime_giving');
  }

  const totalGifts = toInteger(pickValue(record, ['total_gifts', 'totalGifts']), 'total_gifts');

  if (totalGifts !== null) {
    donorData.total_gifts = totalGifts;
  }

  const lastGiftAmount = pickValue(record, ['last_gift_amount', 'lastGiftAmount']);

  if (hasValue(lastGiftAmount)) {
    donorData.last_gift_amount = toDecimal(lastGiftAmount, 'last_gift_amount');
  }

  const lastGiftDate = toDateOnly(pickValue(record, ['last_gift_date', 'lastGiftDate']), 'last_gift_date');

  if (lastGiftDate) {
    donorData.last_gift_date = lastGiftDate;
  }

  const preferredChannel = toOptionalText(pickValue(record, ['preferred_channel', 'preferredChannel']));

  if (preferredChannel) {
    donorData.preferred_channel = preferredChannel;
  }

  return donorData;
}

function buildDonationData(record, donorCodeToId) {
  const donorCode = toOptionalText(pickValue(record, ['donor_code', 'donorCode', 'code']));
  const donorId = donorCode ? donorCodeToId.get(donorCode) || null : null;
  const donorName =
    toOptionalText(pickValue(record, ['donor_name', 'donorName', 'name'])) ||
    'Anonymous Donor';
  const donorEmail =
    toOptionalText(pickValue(record, ['donor_email', 'donorEmail', 'email'])) ||
    'anonymous@example.com';

  const donationData = {
    donation_id: toRequiredText(pickValue(record, ['donation_id', 'donationId', 'id']), 'donation_id'),
    donor_id: donorId,
    donor_name: donorName,
    donor_email: donorEmail,
    amount: toDecimal(pickValue(record, ['amount']), 'amount'),
    donation_date: toDateOnly(pickValue(record, ['donation_date', 'donationDate', 'date']), 'donation_date', true),
  };

  const currency = toOptionalText(pickValue(record, ['currency']));
  const campaign = toOptionalText(pickValue(record, ['campaign']));
  const designation = toOptionalText(pickValue(record, ['designation']));
  const recurringStatus = toOptionalText(pickValue(record, ['recurring_status', 'recurringStatus']));
  const source = toOptionalText(pickValue(record, ['source']));

  if (currency) {
    donationData.currency = currency;
  }

  if (campaign) {
    donationData.campaign = campaign;
  }

  if (designation) {
    donationData.designation = designation;
  }

  if (recurringStatus) {
    donationData.recurring_status = recurringStatus;
  }

  if (source) {
    donationData.source = source;
  }

  donationData.acknowledgment_status = 'received';

  return donationData;
}

async function main() {
  let rawDataset;

  try {
    rawDataset = JSON.parse(await fsPromises.readFile(datasetPath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read seed dataset at ${datasetPath}: ${error.message}`);
  }

  const dataset = normalizeDataset(rawDataset);
  prisma = createPrismaClient();

  const auditLogSeedRecord = rawDataset.audit_log_seed_record;

  if (!auditLogSeedRecord || typeof auditLogSeedRecord !== 'object' || Array.isArray(auditLogSeedRecord)) {
    throw new Error('Seed dataset is missing audit_log_seed_record');
  }

  const result = await prisma.$transaction(async (tx) => {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (isDevelopment) {
      await tx.email_logs.deleteMany();
      await tx.drafts.deleteMany();
      await tx.donations.deleteMany();
      await tx.donors.deleteMany();
      await tx.audit_logs.deleteMany();
    }

    const donorCodeToId = new Map();
    let donorsInserted = 0;

    for (const record of dataset.donors) {
      const donorData = buildDonorData(record);
      const createdDonor = await tx.donors.create({ data: donorData });
      donorsInserted += 1;

      const donorCode = toOptionalText(pickValue(record, ['donor_code', 'donorCode', 'code']));

      if (donorCode) {
        donorCodeToId.set(donorCode, createdDonor.id);
      }
    }

    let donationsInserted = 0;
    let noMatchDonationsInserted = 0;

    for (const record of dataset.donations) {
      const donationData = buildDonationData(record, donorCodeToId);

      if (!donationData.donor_id) {
        noMatchDonationsInserted += 1;
      }

      await tx.donations.create({ data: donationData });
      donationsInserted += 1;
    }

    await tx.audit_logs.create({ data: auditLogSeedRecord });

    return {
      donorsInserted,
      donationsInserted,
      noMatchDonationsInserted,
    };
  }, {
    maxWait: 60000,
    timeout: 120000,
  });

  console.log(`donors inserted: ${result.donorsInserted}`);
  console.log(`donations inserted: ${result.donationsInserted}`);
  console.log(`no-match donations inserted: ${result.noMatchDonationsInserted}`);
  console.log('seed completed');
}

main()
  .catch((error) => {
    console.error('seed failed');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
