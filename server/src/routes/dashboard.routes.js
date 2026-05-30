const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/summary', dashboardController.getDashboardSummary);

module.exports = router;