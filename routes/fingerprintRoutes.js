const express = require('express');
const router = express.Router();
const fingerprintController = require('../controllers/fingerprintController');
const { apiAuthMiddleware } = require('../middlewares/authMiddleware');

// Apply auth middleware to all routes
router.use(apiAuthMiddleware);

// Fingerprint enrollment page
router.get('/enroll', fingerprintController.showEnrollmentPage);

// API endpoints
router.get('/api/bridge-info', fingerprintController.getBridgeInfo);
router.get('/api/capture-stream', fingerprintController.captureFingerprintStream);
router.post('/api/capture', fingerprintController.captureFingerprint);
router.post('/api/enroll', fingerprintController.enrollFingerprint);
router.post('/api/mock-enroll', fingerprintController.mockEnrollFingerprint);
router.get('/api/student/:studentId/fingerprints', fingerprintController.getStudentFingerprints);
router.delete('/api/fingerprint/:fingerprintId', fingerprintController.deleteFingerprint);
router.post('/api/capture-for-attendance', fingerprintController.captureForAttendance);
router.post('/api/match-for-attendance', fingerprintController.matchForAttendance);
router.post('/api/mock-capture-for-attendance', fingerprintController.mockCaptureForAttendance);

module.exports = router;
