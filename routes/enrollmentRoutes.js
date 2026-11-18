const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const { apiAuthMiddleware } = require('../middlewares/authMiddleware');

// Apply auth middleware to all routes
router.use(apiAuthMiddleware);

// Enrollment routes
router.post('/enroll', enrollmentController.enrollStudent);
router.post('/unenroll', enrollmentController.unenrollStudent);
router.get('/course/:courseId', enrollmentController.getCourseEnrollments);
router.get('/student/:studentId', enrollmentController.getStudentCourses);

module.exports = router;
