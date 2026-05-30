const express = require('express');
const draftController = require('../controllers/draft.controller');

const router = express.Router();

router.get('/', draftController.getDrafts);
router.get('/by-donation-id/:donationId', draftController.getDraftByDonationId);
router.get('/:id', draftController.getDraftById);
router.post('/generate', draftController.generateDraft);
router.patch('/:id', draftController.updateDraft);

module.exports = router;
