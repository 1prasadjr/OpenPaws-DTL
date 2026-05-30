const express = require('express');
const donationController = require('../controllers/donation.controller');

const router = express.Router();

router.get('/', donationController.getDonations);
router.get('/by-donation-id/:donationId', donationController.getDonationByDonationId);
router.get('/:id', donationController.getDonationById);
router.post('/', donationController.createDonation);

module.exports = router;
