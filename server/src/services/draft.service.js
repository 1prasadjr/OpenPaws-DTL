const { prisma } = require('../config/prisma');
const donationService = require('./donation.service');
const { generateThankYouDraft } = require('./openrouter.service');

const draftSelect = {
  id: true,
  donation_id: true,
  donor_id: true,
  donor_email: true,
  draft_subject: true,
  draft_body: true,
  edited_body: true,
  ai_reasoning: true,
  personalization_points: true,
  risk_flags: true,
  match_status: true,
  match_confidence: true,
  review_status: true,
  email_status: true,
  approved_by: true,
  approved_at: true,
  created_at: true,
  updated_at: true,
};

const donorRelationSelect = {
  id: true,
  donor_code: true,
  first_name: true,
  last_name: true,
  full_name: true,
  email: true,
  donor_type: true,
  lifetime_giving: true,
  total_gifts: true,
  last_gift_amount: true,
  last_gift_date: true,
  recurring_status: true,
  preferred_channel: true,
  campaign_history: true,
  stewardship_notes: true,
  tags: true,
};

const donationRelationSelect = {
  id: true,
  donation_id: true,
  donor_id: true,
  donor_name: true,
  donor_email: true,
  amount: true,
  currency: true,
  donation_date: true,
  campaign: true,
  designation: true,
  recurring_status: true,
  source: true,
  acknowledgment_status: true,
  created_at: true,
  updated_at: true,
  donors: {
    select: donorRelationSelect,
  },
};

const draftDetailSelect = {
  ...draftSelect,
  donations: {
    select: donationRelationSelect,
  },
  donors: {
    select: donorRelationSelect,
  },
};

function toNumberString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return [];
}

function normalizePagination(pageValue, limitValue) {
  const page = Number.parseInt(pageValue, 10);
  const limit = Number.parseInt(limitValue, 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100),
  };
}

function shapeDonation(record) {
  if (!record) {
    return record;
  }

  const { donors, ...donation } = record;

  return {
    ...donation,
    donor: donors || null,
  };
}

function shapeDraft(record) {
  if (!record) {
    return record;
  }

  const { donations, donors, ...draft } = record;

  return {
    ...draft,
    donation: shapeDonation(donations),
    donor: donors || null,
  };
}

function buildDraftWhere(filters = {}) {
  const where = {};

  if (filters.review_status) {
    where.review_status = filters.review_status;
  }

  if (filters.email_status) {
    where.email_status = filters.email_status;
  }

  if (filters.match_status) {
    where.match_status = filters.match_status;
  }

  if (filters.search) {
    const term = filters.search.trim();

    if (term) {
      where.OR = [
        { donor_email: { contains: term, mode: 'insensitive' } },
        { draft_subject: { contains: term, mode: 'insensitive' } },
        { draft_body: { contains: term, mode: 'insensitive' } },
        { edited_body: { contains: term, mode: 'insensitive' } },
        { ai_reasoning: { contains: term, mode: 'insensitive' } },
        { donors: { is: { email: { contains: term, mode: 'insensitive' } } } },
        { donations: { is: { donation_id: { contains: term, mode: 'insensitive' } } } },
        { donations: { is: { donor_name: { contains: term, mode: 'insensitive' } } } },
      ];
    }
  }

  return where;
}

function parseFullName(fullName) {
  const parts = normalizeText(fullName)?.split(/\s+/).filter(Boolean) || [];

  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function normalizeDraftBody(bodyText) {
  if (!bodyText) {
    return null;
  }

  const text = String(bodyText).trim();
  return text || null;
}

function isAnonymousLike(donation) {
  const donorName = normalizeText(donation.donor_name)?.toLowerCase() || '';
  const donorEmail = normalizeText(donation.donor_email)?.toLowerCase() || '';

  return donorName.includes('anonymous') || donorEmail.includes('anonymous') || donorEmail.includes('nomatch');
}

async function fetchDonationForDraft(donationId) {
  const byDonationId = await donationService.getDonationByDonationId(donationId);

  if (byDonationId) {
    return byDonationId;
  }

  return donationService.getDonationById(donationId);
}

async function getDrafts(filters = {}) {
  const { page, limit } = normalizePagination(filters.page, filters.limit);
  const where = buildDraftWhere(filters);

  const [total, data] = await Promise.all([
    prisma.drafts.count({ where }),
    prisma.drafts.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: draftDetailSelect,
    }),
  ]);

  return {
    data: data.map(shapeDraft),
    pagination: {
      page,
      limit,
      total,
    },
  };
}

async function getDraftById(id) {
  const draft = await prisma.drafts.findUnique({
    where: { id },
    select: draftDetailSelect,
  });

  return shapeDraft(draft);
}

async function getDraftByDonationId(donationId) {
  const donation = await donationService.getDonationByDonationId(donationId);

  if (!donation) {
    return null;
  }

  const draft = await prisma.drafts.findFirst({
    where: { donation_id: donation.id },
    orderBy: { created_at: 'desc' },
    select: draftDetailSelect,
  });

  return shapeDraft(draft);
}

async function updateDraft(id, payload) {
  const data = {};

  if (payload.draft_subject !== undefined) {
    data.draft_subject = payload.draft_subject;
  }

  if (payload.edited_body !== undefined) {
    data.edited_body = normalizeDraftBody(payload.edited_body);
  }

  if (payload.review_status !== undefined) {
    data.review_status = payload.review_status;

    if (payload.review_status === 'approved') {
      data.approved_at = payload.approved_at ? new Date(payload.approved_at) : new Date();
    }

    if (payload.review_status === 'rejected') {
      data.approved_at = null;
    }
  }

  if (payload.email_status !== undefined) {
    data.email_status = payload.email_status;
  }

  if (payload.approved_by !== undefined) {
    data.approved_by = payload.approved_by;
  }

  const updatedDraft = await prisma.$transaction(async (tx) => {
    const draft = await tx.drafts.update({
      where: { id },
      data,
      select: draftDetailSelect,
    });

    await tx.audit_logs.create({
      data: {
        entity_type: 'drafts',
        entity_id: draft.id,
        action: 'draft_updated',
        actor: payload.approved_by || 'system',
        status: 'success',
        metadata: {
          review_status: draft.review_status,
          email_status: draft.email_status,
        },
      },
    });

    return draft;
  });

  return shapeDraft(updatedDraft);
}

async function findCandidateDonor(donation) {
  if (donation.donor) {
    return donation.donor;
  }

  if (isAnonymousLike(donation)) {
    return null;
  }

  const trimmedName = normalizeText(donation.donor_name);
  const trimmedEmail = normalizeText(donation.donor_email);
  const { firstName, lastName } = parseFullName(trimmedName);

  const conditions = [];

  if (trimmedEmail) {
    conditions.push({ email: { equals: trimmedEmail, mode: 'insensitive' } });
  }

  if (trimmedName) {
    conditions.push({ full_name: { equals: trimmedName, mode: 'insensitive' } });
  }

  if (firstName && lastName) {
    conditions.push({
      AND: [
        { first_name: { equals: firstName, mode: 'insensitive' } },
        { last_name: { equals: lastName, mode: 'insensitive' } },
      ],
    });
  }

  if (conditions.length === 0) {
    return null;
  }

  return prisma.donors.findFirst({
    where: {
      OR: conditions,
    },
  });
}

function deriveMatchMetadata(donation, matchedDonor) {
  if (donation.donor_id) {
    return { match_status: 'matched', match_confidence: 95 };
  }

  if (matchedDonor) {
    return { match_status: 'uncertain', match_confidence: 65 };
  }

  if (isAnonymousLike(donation)) {
    return { match_status: 'no_match', match_confidence: 10 };
  }

  return { match_status: 'no_match', match_confidence: 25 };
}

function buildDonorSummary(donor) {
  if (!donor) {
    return null;
  }

  const fullName = normalizeText(donor.full_name) || [donor.first_name, donor.last_name].filter(Boolean).join(' ') || null;

  return {
    donor_code: normalizeText(donor.donor_code),
    full_name: fullName,
    first_name: normalizeText(donor.first_name),
    last_name: normalizeText(donor.last_name),
    email: normalizeText(donor.email),
    donor_type: normalizeText(donor.donor_type),
    lifetime_giving: toNumberString(donor.lifetime_giving),
    total_gifts: donor.total_gifts ?? null,
    last_gift_amount: toNumberString(donor.last_gift_amount),
    last_gift_date: formatDate(donor.last_gift_date),
    recurring_status: donor.recurring_status ?? null,
    preferred_channel: normalizeText(donor.preferred_channel),
    campaign_history: normalizeArray(donor.campaign_history),
    stewardship_notes: normalizeText(donor.stewardship_notes),
    tags: normalizeArray(donor.tags),
  };
}

function buildDonationSummary(donation) {
  return {
    donation_id: donation.donation_id,
    amount: toNumberString(donation.amount),
    currency: normalizeText(donation.currency) || 'USD',
    donation_date: formatDate(donation.donation_date),
    campaign: normalizeText(donation.campaign),
    designation: normalizeText(donation.designation),
    recurring_status: normalizeText(donation.recurring_status),
    source: normalizeText(donation.source),
    acknowledgment_status: normalizeText(donation.acknowledgment_status),
    donor_name: normalizeText(donation.donor_name),
    donor_email: normalizeText(donation.donor_email),
  };
}

function buildPromptPayload({ donation, donorSummary, matchedDonor, matchMetadata }) {
  const fallbackGreeting = donorSummary?.full_name || donorSummary?.first_name || 'Friend';

  return {
    goal: 'Write a heartfelt thank-you email draft for a donor stewardship workflow.',
    style: {
      tone: ['appreciative', 'sentimental', 'human', 'polished', 'warm'],
      length: 'about 130-190 words',
      constraints: [
        'Do not sound robotic or templated.',
        'Do not mention AI, models, or prompting.',
        'Do not fabricate facts beyond the metadata.',
        'Use the provided donor history to personalize the message.',
        'If the match is uncertain or no-match, stay gracious and avoid over-specific claims.',
      ],
    },
    recipient: {
      greeting_name: fallbackGreeting,
      recipient_email: donation.donor_email,
      match_status: matchMetadata.match_status,
      match_confidence: matchMetadata.match_confidence,
      matched_donor_profile: donorSummary,
      matched_donor_preview: matchedDonor ? buildDonorSummary(matchedDonor) : null,
    },
    donation: buildDonationSummary(donation),
    output_format: {
      subject: 'short subject line',
      body: 'complete email body with greeting and closing',
      reasoning: '1-3 sentence rationale for why the draft fits the donor context',
      personalization_points: ['short bullet points'],
      risk_flags: ['anything to verify before human approval'],
    },
    writing_guidance: [
      'Open with gratitude and specificity.',
      'Mention the campaign, designation, and donor history when relevant.',
      'For recurring or major donors, recognize consistency or leadership.',
      'For first-time donors, welcome them warmly.',
      'For lapsed-returning donors, thank them for coming back without highlighting the lapse negatively.',
      'For anonymous or uncertain matches, keep the message safe, respectful, and general.',
      'Close with a gentle, grateful sign-off and a [Sender Name] placeholder.',
    ],
  };
}

async function generateDraftForDonation({ donationId, model }) {
  const donation = await fetchDonationForDraft(donationId);

  if (!donation) {
    const error = new Error('Donation not found');
    error.statusCode = 404;
    throw error;
  }

  const matchedDonor = await findCandidateDonor(donation);
  const donorSummary = buildDonorSummary(donation.donor || matchedDonor);
  const matchMetadata = deriveMatchMetadata(donation, matchedDonor);
  const promptPayload = buildPromptPayload({
    donation,
    donorSummary,
    matchedDonor,
    matchMetadata,
  });

  const llmResult = await generateThankYouDraft(promptPayload, model);

  if (!llmResult.draft.subject || !llmResult.draft.body) {
    const error = new Error('OpenRouter returned an incomplete draft');
    error.statusCode = 502;
    throw error;
  }

  const draftRecord = await prisma.$transaction(async (tx) => {
    const createdDraft = await tx.drafts.create({
      data: {
        donation_id: donation.id,
        donor_id: donation.donor_id || null,
        donor_email: donation.donor_email,
        draft_subject: llmResult.draft.subject,
        draft_body: llmResult.draft.body,
        edited_body: null,
        ai_reasoning: llmResult.draft.reasoning,
        personalization_points: llmResult.draft.personalization_points,
        risk_flags: llmResult.draft.risk_flags,
        match_status: matchMetadata.match_status,
        match_confidence: matchMetadata.match_confidence,
        review_status: 'pending_review',
        email_status: 'not_started',
      },
      select: draftSelect,
    });

    await tx.audit_logs.create({
      data: {
        entity_type: 'drafts',
        entity_id: createdDraft.id,
        action: 'thank_you_draft_generated',
        actor: 'system',
        status: 'success',
        metadata: {
          donation_id: donation.id,
          donation_code: donation.donation_id,
          model: llmResult.model,
          match_status: matchMetadata.match_status,
          match_confidence: matchMetadata.match_confidence,
        },
      },
    });

    return createdDraft;
  });

  return {
    model: llmResult.model,
    draft: shapeDraft(draftRecord),
    match_status: matchMetadata.match_status,
    match_confidence: matchMetadata.match_confidence,
    donation: buildDonationSummary(donation),
    donor: donorSummary,
  };
}

module.exports = {
  getDrafts,
  getDraftById,
  getDraftByDonationId,
  updateDraft,
  generateDraftForDonation,
};
