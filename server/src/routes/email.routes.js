const express = require('express');
const emailController = require('../controllers/email.controller');

const router = express.Router();

router.get('/gmail/auth', emailController.startGmailAuth);
router.get('/gmail/oauth2callback', emailController.handleGmailOAuthCallback);
router.post('/reject/:draftId', emailController.rejectDraft);
router.patch('/save/:draftId', emailController.saveDraft);
router.post('/approve-and-send/:draftId', emailController.approveAndSendDraft);
router.post('/batch-approve-and-send', emailController.bulkApproveAndSendDrafts);
router.post('/batch-approve', emailController.bulkApproveDrafts);
router.post('/batch-send', emailController.bulkSendApprovedDrafts);

module.exports = router;