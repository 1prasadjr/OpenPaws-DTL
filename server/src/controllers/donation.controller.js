const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const donationService = require('../services/donation.service');

const createDonationSchema = z.object({
  donation_id: z.string().trim().min(1),
  donor_name: z.string().trim().min(1),
  donor_email: z.string().trim().email(),
  amount: z.coerce.number().positive(),
  donation_date: z.coerce.date(),
  currency: z.string().trim().min(1).optional(),
  campaign: z.string().trim().min(1).optional(),
  designation: z.string().trim().min(1).optional(),
  recurring_status: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
});

const getDonations = asyncHandler(async (req, res) => {
  const { search, status, page, limit } = req.query;
  const result = await donationService.getDonations({ search, status, page, limit });

  return successResponse(res, result, undefined, 200);
});

const getDonationById = asyncHandler(async (req, res) => {
  const donation = await donationService.getDonationById(req.params.id);

  if (!donation) {
    return errorResponse(res, 'Donation not found', 404);
  }

  return successResponse(res, { data: donation }, undefined, 200);
});

const getDonationByDonationId = asyncHandler(async (req, res) => {
  const donation = await donationService.getDonationByDonationId(req.params.donationId);

  if (!donation) {
    return errorResponse(res, 'Donation not found', 404);
  }

  return successResponse(res, { data: donation }, undefined, 200);
});

const createDonation = asyncHandler(async (req, res) => {
  const parsedBody = createDonationSchema.parse(req.body);
  const donation = await donationService.createDonation(parsedBody);

  return successResponse(res, { data: donation }, 'Donation created successfully', 201);
});

module.exports = {
  getDonations,
  getDonationById,
  getDonationByDonationId,
  createDonation,
};
