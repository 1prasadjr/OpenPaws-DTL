const express = require('express');
const donorController = require('../controllers/donor.controller');

const router = express.Router();

router.get('/', donorController.getDonors);
router.get('/email/:email', donorController.getDonorByEmail);
router.get('/:id', donorController.getDonorById);

module.exports = router;
