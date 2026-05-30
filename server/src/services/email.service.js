const { prisma } = require('../config/prisma');
const draftService = require('./draft.service');
const { createGmailDraft, sendGmailEmail } = require('./gmail.service');
const { normalizeEmailBody } = require('../utils/emailText');

const draftSelect = {
  id: true,
  donation_id: true,
  donor_email: true,
  draft_subject: true,
  draft_body: true,
  edited_body: true,
  review_status: true,
  email_status: true,
  approved_by: true,
  approved_at: true,
  created_at: true,
  updated_at: true,
};

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function createNotFoundError() {
  const error = new Error('Draft not found');
  error.statusCode = 404;
  return error;
}

function getEmailMode() {
  const mode = normalizeText(process.env.EMAIL_MODE).toLowerCase();
  return mode === 'send' ? 'send' : 'draft';
}

function getEmailAction(status) {
  if (status === 'draft_created') {
    return 'email_draft_created';
  }

  if (status === 'sent') {
    return 'email_sent';
  }

  return 'email_failed';
}

function getAuditStatus(status) {
  return status === 'failed' ? 'failure' : 'success';
}

function buildEmailLogData({ draft, recipientEmail, subject, status, providerMessageId = null, errorMessage = null }) {
  return {
    draft_id: draft.id,
    donation_id: draft.donation_id || null,
    recipient_email: recipientEmail,
    subject,
    provider: 'gmail',
    status,
    provider_message_id: providerMessageId,
    error_message: errorMessage,
    sent_at: status === 'sent' ? new Date() : null,
  };
}

function buildAuditMetadata({ draft, emailMode, recipientEmail, subject, status, providerMessageId = null, errorMessage = null }) {
  const metadata = {
    email_mode: emailMode,
    email_status: status,
    recipient_email: recipientEmail,
    subject,
    provider: 'gmail',
  };

  if (draft.donation_id) {
    metadata.donation_id = draft.donation_id;
  }

  if (providerMessageId) {
    metadata.provider_message_id = providerMessageId;
  }

  if (errorMessage) {
    metadata.error_message = errorMessage;
  }

  return metadata;
}

async function processApprovedDraft(draft, { approvedBy, emailMode }) {
  const recipientEmail = normalizeText(draft.donor_email);
  const subject = normalizeText(draft.draft_subject);
  const body = normalizeEmailBody(draft.edited_body || draft.draft_body);

  if (!recipientEmail) {
    const error = new Error('Draft recipient email is missing');
    error.statusCode = 400;
    throw error;
  }

  if (!subject) {
    const error = new Error('Draft subject is missing');
    error.statusCode = 400;
    throw error;
  }

  if (!body) {
    const error = new Error('Draft body is missing');
    error.statusCode = 400;
    throw error;
  }

  try {
    if (emailMode === 'draft') {
      const gmailDraft = await createGmailDraft({
        to: recipientEmail,
        subject,
        body,
      });

      return persistEmailOutcome({
        draftId: draft.id,
        draft,
        emailMode,
        actor: approvedBy,
        recipientEmail,
        subject,
        status: 'draft_created',
        providerMessageId: gmailDraft?.id || gmailDraft?.message?.id || null,
      });
    }

    const sentEmail = await sendGmailEmail({
      to: recipientEmail,
      subject,
      body,
    });

    return persistEmailOutcome({
      draftId: draft.id,
      draft,
      emailMode,
      actor: approvedBy,
      recipientEmail,
      subject,
      status: 'sent',
      providerMessageId: sentEmail?.id || sentEmail?.threadId || null,
    });
  } catch (error) {
    const failureMessage = error?.response?.data?.error?.message || error.message || 'Unable to process Gmail request';

    try {
      await persistEmailOutcome({
        draftId: draft.id,
        draft,
        emailMode,
        actor: approvedBy,
        recipientEmail,
        subject,
        status: 'failed',
        errorMessage: failureMessage,
      });
    } catch (logError) {
      const combinedError = new Error(`${failureMessage} (and failed to write email log: ${logError.message})`);
      combinedError.statusCode = logError.statusCode || logError.status || 500;
      throw combinedError;
    }

    const gmailError = new Error(failureMessage);
    gmailError.statusCode = error.statusCode || error.status || 502;
    throw gmailError;
  }
}

async function getDraftRecord(txOrPrisma, draftId) {
  return txOrPrisma.drafts.findUnique({
    where: { id: draftId },
    select: draftSelect,
  });
}

async function saveDraftChange({ draftId, data, action, actor = 'system', metadata = {} }) {
  await prisma.$transaction(async (tx) => {
    const existingDraft = await getDraftRecord(tx, draftId);

    if (!existingDraft) {
      throw createNotFoundError();
    }

    await tx.drafts.update({
      where: { id: draftId },
      data,
      select: draftSelect,
    });

    await tx.audit_logs.create({
      data: {
        entity_type: 'drafts',
        entity_id: draftId,
        action,
        actor,
        status: 'success',
        metadata,
      },
    });
  });

  return draftService.getDraftById(draftId);
}

async function rejectDraft(draftId) {
  return saveDraftChange({
    draftId,
    data: {
      review_status: 'rejected',
      approved_by: null,
      approved_at: null,
    },
    action: 'draft_rejected',
    metadata: {
      review_status: 'rejected',
    },
  });
}

async function saveDraft(draftId, payload) {
  const data = {
    review_status: 'edited',
    approved_by: null,
    approved_at: null,
  };

  if (payload.draft_subject !== undefined) {
    data.draft_subject = normalizeText(payload.draft_subject);
  }

  if (payload.edited_body !== undefined) {
    data.edited_body = normalizeEmailBody(payload.edited_body);
  }

  return saveDraftChange({
    draftId,
    data,
    action: 'draft_saved',
    metadata: {
      review_status: 'edited',
      changed_fields: Object.keys(payload).filter((key) => payload[key] !== undefined),
    },
  });
}

async function markDraftApproved(draftId, approvedBy) {
  await prisma.$transaction(async (tx) => {
    const existingDraft = await getDraftRecord(tx, draftId);

    if (!existingDraft) {
      throw createNotFoundError();
    }

    const updatedDraft = await tx.drafts.update({
      where: { id: draftId },
      data: {
        review_status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date(),
      },
      select: draftSelect,
    });

    await tx.audit_logs.create({
      data: {
        entity_type: 'drafts',
        entity_id: draftId,
        action: 'draft_approved',
        actor: approvedBy,
        status: 'success',
        metadata: {
          review_status: 'approved',
          email_status: updatedDraft.email_status,
        },
      },
    });
  });

  return draftService.getDraftById(draftId);
}

async function persistEmailOutcome({ draftId, draft, emailMode, actor, recipientEmail, subject, status, providerMessageId = null, errorMessage = null }) {
  let emailLogRecord = null;

  await prisma.$transaction(async (tx) => {
    await tx.drafts.update({
      where: { id: draftId },
      data: {
        email_status: status,
      },
      select: draftSelect,
    });

    emailLogRecord = await tx.email_logs.create({
      data: buildEmailLogData({
        draft,
        recipientEmail,
        subject,
        status,
        providerMessageId,
        errorMessage,
      }),
    });

    await tx.audit_logs.create({
      data: {
        entity_type: 'drafts',
        entity_id: draftId,
        action: getEmailAction(status),
        actor,
        status: getAuditStatus(status),
        metadata: buildAuditMetadata({
          draft,
          emailMode,
          recipientEmail,
          subject,
          status,
          providerMessageId,
          errorMessage,
        }),
      },
    });

  });

  const shapedDraft = await draftService.getDraftById(draftId);

  return {
    draft: shapedDraft,
    emailLog: emailLogRecord,
  };
}

async function approveAndSendDraft(draftId, payload = {}) {
  const approvedBy = normalizeText(payload.approved_by) || 'system';
  const emailMode = getEmailMode();

  const approvedDraft = await markDraftApproved(draftId, approvedBy);

  if (!approvedDraft) {
    throw createNotFoundError();
  }

  return processApprovedDraft(approvedDraft, { approvedBy, emailMode });
}

async function bulkApproveAndSendDrafts(draftIds = [], payload = {}) {
  const approvedBy = normalizeText(payload.approved_by) || 'system';
  const uniqueDraftIds = [...new Set((Array.isArray(draftIds) ? draftIds : []).map((draftId) => normalizeText(draftId)).filter(Boolean))];

  if (!uniqueDraftIds.length) {
    const error = new Error('At least one draft ID is required');
    error.statusCode = 400;
    throw error;
  }

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const draftId of uniqueDraftIds) {
    try {
      const result = await approveAndSendDraft(draftId, { approved_by: approvedBy });
      successCount += 1;

      results.push({
        draftId,
        success: true,
        message: result.draft?.email_status === 'draft_created' ? 'Email draft created' : 'Email sent',
        data: result,
      });
    } catch (error) {
      failureCount += 1;

      results.push({
        draftId,
        success: false,
        message: error.message || 'Unable to process draft',
      });
    }
  }

  return {
    summary: {
      total: uniqueDraftIds.length,
      successCount,
      failureCount,
    },
    results,
  };
}

async function bulkApproveDrafts(payload = {}) {
  const approvedBy = normalizeText(payload.approved_by) || 'system';
  const draftsToApprove = await prisma.drafts.findMany({
    where: {
      review_status: {
        in: ['pending_review', 'edited'],
      },
    },
    select: draftSelect,
    orderBy: [{ created_at: 'asc' }],
  });

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const draft of draftsToApprove) {
    try {
      const approvedDraft = await markDraftApproved(draft.id, approvedBy);
      successCount += 1;

      results.push({
        draftId: draft.id,
        success: true,
        message: 'Draft approved',
        data: { draft: approvedDraft },
      });
    } catch (error) {
      failureCount += 1;

      results.push({
        draftId: draft.id,
        success: false,
        message: error.message || 'Unable to approve draft',
      });
    }
  }

  return {
    summary: {
      total: draftsToApprove.length,
      successCount,
      failureCount,
    },
    results,
  };
}

async function bulkSendApprovedDrafts(payload = {}) {
  const approvedBy = normalizeText(payload.approved_by) || 'system';
  const emailMode = getEmailMode();
  const draftsToSend = await prisma.drafts.findMany({
    where: {
      review_status: 'approved',
      email_status: {
        in: ['not_started', 'failed', 'retry_pending'],
      },
    },
    select: draftSelect,
    orderBy: [{ approved_at: 'asc' }, { created_at: 'asc' }],
  });

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const draft of draftsToSend) {
    try {
      const result = await processApprovedDraft(draft, { approvedBy, emailMode });
      successCount += 1;

      results.push({
        draftId: draft.id,
        success: true,
        message: result.draft?.email_status === 'draft_created' ? 'Email draft created' : 'Email sent',
        data: result,
      });
    } catch (error) {
      failureCount += 1;

      results.push({
        draftId: draft.id,
        success: false,
        message: error.message || 'Unable to process draft',
      });
    }
  }

  return {
    summary: {
      total: draftsToSend.length,
      successCount,
      failureCount,
    },
    results,
  };
}

module.exports = {
  rejectDraft,
  saveDraft,
  approveAndSendDraft,
  bulkApproveAndSendDrafts,
  bulkApproveDrafts,
  bulkSendApprovedDrafts,
  markDraftApproved,
};