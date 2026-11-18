const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { apiAuthMiddleware } = require('../middlewares/authMiddleware');

// Apply auth middleware to all routes
router.use(apiAuthMiddleware);

// Report routes
router.get('/course/:courseId', reportController.showCourseReport);
router.get('/course/:courseId/export-excel', reportController.exportCourseReportExcel);
router.get('/course/:courseId/export-csv', reportController.exportCourseReportCSV);
router.get('/course/:courseId/statistics', reportController.getCourseStatistics);
router.get('/student/:studentId/course/:courseId/statistics', reportController.getStudentStatistics);

module.exports = router;
