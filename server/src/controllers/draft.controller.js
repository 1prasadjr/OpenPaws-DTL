const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const draftService = require('../services/draft.service');

const generateDraftSchema = z
  .object({
    donation_id: z.string().trim().min(1).optional(),
    donationId: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
  })
  .refine((value) => value.donation_id || value.donationId, {
    message: 'donation_id is required',
    path: ['donation_id'],
  });

const listDraftsSchema = z.object({
  search: z.string().trim().optional(),
  review_status: z.string().trim().optional(),
  email_status: z.string().trim().optional(),
  match_status: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const updateDraftSchema = z.object({
  draft_subject: z.string().trim().min(1).optional(),
  edited_body: z.string().trim().min(1).optional().nullable(),
  review_status: z.enum(['pending_review', 'edited', 'approved', 'rejected']).optional(),
  email_status: z.enum(['not_started', 'draft_created', 'sent', 'failed', 'retry_pending', 'cancelled']).optional(),
  approved_by: z.string().trim().min(1).optional().nullable(),
  approved_at: z.coerce.date().optional().nullable(),
});

const getDrafts = asyncHandler(async (req, res) => {
  const parsedQuery = listDraftsSchema.parse(req.query || {});
  const result = await draftService.getDrafts(parsedQuery);

  return successResponse(res, result, undefined, 200);
});

const getDraftById = asyncHandler(async (req, res) => {
  const draft = await draftService.getDraftById(req.params.id);

  if (!draft) {
    return errorResponse(res, 'Draft not found', 404);
  }

  return successResponse(res, { data: draft }, undefined, 200);
});

const getDraftByDonationId = asyncHandler(async (req, res) => {
  const draft = await draftService.getDraftByDonationId(req.params.donationId);

  if (!draft) {
    return errorResponse(res, 'Draft not found', 404);
  }

  return successResponse(res, { data: draft }, undefined, 200);
});

const updateDraft = asyncHandler(async (req, res) => {
  const parsedBody = updateDraftSchema.parse(req.body || {});
  const draft = await draftService.updateDraft(req.params.id, parsedBody);

  return successResponse(res, { data: draft }, 'Draft updated successfully', 200);
});

const generateDraft = asyncHandler(async (req, res) => {
  const parsedBody = generateDraftSchema.parse(req.body || {});
  const donationId = parsedBody.donation_id || parsedBody.donationId;
  const result = await draftService.generateDraftForDonation({
    donationId,
    model: parsedBody.model,
  });

  return successResponse(res, { data: result }, 'Draft generated successfully', 201);
});

module.exports = {
  getDrafts,
  getDraftById,
  getDraftByDonationId,
  updateDraft,
  generateDraft,
};
