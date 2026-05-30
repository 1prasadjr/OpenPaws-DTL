const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { createOAuthClient } = require('../services/gmail.service');
const emailService = require('../services/email.service');

const saveDraftSchema = z
  .object({
    draft_subject: z.string().trim().min(1).optional(),
    edited_body: z.string().trim().min(1).optional(),
  })
  .refine((value) => value.draft_subject !== undefined || value.edited_body !== undefined, {
    message: 'At least one of draft_subject or edited_body is required',
    path: ['draft_subject'],
  });

const approveDraftSchema = z.object({
  approved_by: z.string().trim().min(1).optional(),
});

const bulkApproveAndSendSchema = z.object({
  draftIds: z.array(z.string().trim().min(1)).min(1),
  approved_by: z.string().trim().min(1).optional(),
});

const bulkWorkflowSchema = z.object({
  approved_by: z.string().trim().min(1).optional(),
});

const startGmailAuth = asyncHandler(async (req, res) => {
  const client = createOAuthClient();

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
  });

  return res.redirect(authUrl);
});

const handleGmailOAuthCallback = asyncHandler(async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';

  if (!code) {
    return errorResponse(res, 'Missing OAuth code', 400);
  }

  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  console.log('GMAIL_REFRESH_TOKEN:', tokens.refresh_token || 'NO_REFRESH_TOKEN_RETURNED');

  return res
    .status(200)
    .type('html')
    .send(
      '<!doctype html><html><body><h1>Gmail OAuth complete</h1><p>Copy the refresh token from the server console into GMAIL_REFRESH_TOKEN in .env.</p></body></html>',
    );
});

const rejectDraft = asyncHandler(async (req, res) => {
  const draft = await emailService.rejectDraft(req.params.draftId);

  return successResponse(res, { data: { draft } }, 'Draft rejected successfully', 200);
});

const saveDraft = asyncHandler(async (req, res) => {
  const parsedBody = saveDraftSchema.parse(req.body || {});
  const draft = await emailService.saveDraft(req.params.draftId, parsedBody);

  return successResponse(res, { data: { draft } }, 'Draft saved successfully', 200);
});

const approveAndSendDraft = asyncHandler(async (req, res) => {
  const parsedBody = approveDraftSchema.parse(req.body || {});
  const result = await emailService.approveAndSendDraft(req.params.draftId, parsedBody);
  const message = result?.draft?.email_status === 'draft_created' ? 'Email draft created' : 'Email sent';

  return successResponse(res, { data: result }, message, 200);
});

const bulkApproveAndSendDrafts = asyncHandler(async (req, res) => {
  const parsedBody = bulkApproveAndSendSchema.parse(req.body || {});
  const result = await emailService.bulkApproveAndSendDrafts(parsedBody.draftIds, {
    approved_by: parsedBody.approved_by,
  });
  const message = result.summary.failureCount > 0
    ? `Batch email workflow completed with ${result.summary.failureCount} failure${result.summary.failureCount === 1 ? '' : 's'}`
    : `Batch email workflow completed for ${result.summary.total} draft${result.summary.total === 1 ? '' : 's'}`;

  return successResponse(res, { data: result }, message, 200);
});

const bulkApproveDrafts = asyncHandler(async (req, res) => {
  const parsedBody = bulkWorkflowSchema.parse(req.body || {});
  const result = await emailService.bulkApproveDrafts(parsedBody);
  const message = result.summary.failureCount > 0
    ? `Batch approval completed with ${result.summary.failureCount} failure${result.summary.failureCount === 1 ? '' : 's'}`
    : `Batch approval completed for ${result.summary.total} draft${result.summary.total === 1 ? '' : 's'}`;

  return successResponse(res, { data: result }, message, 200);
});

const bulkSendApprovedDrafts = asyncHandler(async (req, res) => {
  const parsedBody = bulkWorkflowSchema.parse(req.body || {});
  const result = await emailService.bulkSendApprovedDrafts(parsedBody);
  const message = result.summary.failureCount > 0
    ? `Batch send completed with ${result.summary.failureCount} failure${result.summary.failureCount === 1 ? '' : 's'}`
    : `Batch send completed for ${result.summary.total} approved draft${result.summary.total === 1 ? '' : 's'}`;

  return successResponse(res, { data: result }, message, 200);
});

module.exports = {
  startGmailAuth,
  handleGmailOAuthCallback,
  rejectDraft,
  saveDraft,
  approveAndSendDraft,
  bulkApproveAndSendDrafts,
  bulkApproveDrafts,
  bulkSendApprovedDrafts,
};