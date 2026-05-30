const express = require('express');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

router.get('/', (req, res) => {
  return successResponse(res, undefined, 'Server is running', 200);
});

module.exports = router;
