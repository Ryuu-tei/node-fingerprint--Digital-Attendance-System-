const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { apiAuthMiddleware } = require('../middlewares/authMiddleware');

// Apply auth middleware to all routes
router.use(apiAuthMiddleware);

// Attendance session routes
router.get('/course/:courseId/sessions/api', attendanceController.getCourseSessions);
router.get('/course/:courseId/sessions', attendanceController.showSessionsList);
router.get('/course/:courseId/create-session', attendanceController.showCreateSession);
router.post('/course/:courseId/sessions', attendanceController.createSession);

// Mark attendance
router.get('/session/:sessionId/mark', attendanceController.showMarkAttendance);
router.post('/session/:sessionId/mark', attendanceController.markAttendance);

// Override and close
router.post('/override', attendanceController.overrideAttendance);
router.post('/session/:sessionId/close', attendanceController.closeSession);

// Get records
router.get('/session/:sessionId/records', attendanceController.getSessionRecords);

module.exports = router;
