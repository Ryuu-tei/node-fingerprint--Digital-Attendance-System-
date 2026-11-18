const express = require('express');
const router = express.Router();
const multer = require('multer');
const studentController = require('../controllers/studentController');
const { apiAuthMiddleware } = require('../middlewares/authMiddleware');

// Configure multer for CSV upload
const upload = multer({ dest: 'uploads/' });

// Apply auth middleware to all routes
router.use(apiAuthMiddleware);

// Student management routes
router.get('/', studentController.showStudentsList);
router.get('/create', studentController.showCreateStudent);
router.post('/', studentController.createStudent);
router.get('/detail/:id', studentController.showStudentDetail);
router.put('/:id', studentController.updateStudent);
router.delete('/:id', studentController.deleteStudent);

// Import students
router.get('/import/page', studentController.showImportStudents);
router.post('/import', upload.single('csvFile'), studentController.importStudents);

// Search API
router.get('/api/search', studentController.searchStudents);

module.exports = router;
