const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const donorService = require('../services/donor.service');

const getDonors = asyncHandler(async (req, res) => {
  const { search, donor_type: donorType, page, limit } = req.query;
  const result = await donorService.getDonors({ search, donorType, page, limit });

  return successResponse(res, result, undefined, 200);
});

const getDonorById = asyncHandler(async (req, res) => {
  const donor = await donorService.getDonorById(req.params.id);

  if (!donor) {
    return errorResponse(res, 'Donor not found', 404);
  }

  return successResponse(res, { data: donor }, undefined, 200);
});

const getDonorByEmail = asyncHandler(async (req, res) => {
  const donor = await donorService.getDonorByEmail(req.params.email);

  if (!donor) {
    return errorResponse(res, 'Donor not found', 404);
  }

  return successResponse(res, { data: donor }, undefined, 200);
});

module.exports = {
  getDonors,
  getDonorById,
  getDonorByEmail,
};
