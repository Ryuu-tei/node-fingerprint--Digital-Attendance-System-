const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { apiAuthMiddleware } = require('../middlewares/authMiddleware');

// Apply auth middleware to all routes
router.use(apiAuthMiddleware);

// Course management routes
router.get('/', courseController.showCoursesList);
router.get('/create', courseController.showCreateCourse);
router.post('/', courseController.createCourse);
router.get('/:id', courseController.showCourseDetail);
router.put('/:id', courseController.updateCourse);
router.delete('/:id', courseController.deleteCourse);

// Course students
router.get('/:courseId/students', courseController.getCourseStudents);
router.get('/:id/manage-students', courseController.showManageStudents);

module.exports = router;
