const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const dashboardService = require('../services/dashboard.service');

const getDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getDashboardSummary();

  return successResponse(res, { data: summary }, undefined, 200);
});

module.exports = {
  getDashboardSummary,
};