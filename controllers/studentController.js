const studentService = require('../services/studentService');
const csv = require('csv-parser');
const fs = require('fs');

/**
 * Show students list page
 */
exports.showStudentsList = async (req, res) => {
  try {
    const result = await studentService.getAllStudents();
    res.render('students/list', {
      students: result.data,
      count: result.count
    });
  } catch (error) {
    console.error('Error showing students list:', error);
    res.render('students/list', {
      error: 'Failed to load students'
    });
  }
};

/**
 * Show create student page
 */
exports.showCreateStudent = (req, res) => {
  res.render('students/create');
};

/**
 * Create student
 */
exports.createStudent = async (req, res) => {
  try {
    const result = await studentService.createStudent(req.body);

    if (!result.success) {
      return res.render('students/create', {
        error: result.error
      });
    }

    res.redirect('/students?message=Student created successfully');
  } catch (error) {
    console.error('Error creating student:', error);
    res.render('students/create', {
      error: 'Failed to create student'
    });
  }
};

/**
 * Show student details
 */
exports.showStudentDetail = async (req, res) => {
  try {
    const result = await studentService.getStudentDetails(req.params.id);

    if (!result.success) {
      return res.status(404).render('error', {
        message: result.error
      });
    }

    res.render('students/detail', {
      student: result.data
    });
  } catch (error) {
    console.error('Error showing student details:', error);
    res.render('error', {
      message: 'Failed to load student details'
    });
  }
};

/**
 * Update student
 */
exports.updateStudent = async (req, res) => {
  try {
    const result = await studentService.updateStudent(req.params.id, req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update student'
    });
  }
};

/**
 * Delete student
 */
exports.deleteStudent = async (req, res) => {
  try {
    const result = await studentService.deleteStudent(req.params.id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete student'
    });
  }
};

/**
 * Show import students page
 */
exports.showImportStudents = (req, res) => {
  res.render('students/import');
};

/**
 * Import students from CSV
 */
exports.importStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.render('students/import', {
        error: 'No file uploaded'
      });
    }

    const csvData = [];
    const filePath = req.file.path;

    // Parse CSV file
    try {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', async () => {
          // Process CSV data
          const result = await studentService.importStudentsFromCSV(csvData);

          // Clean up file
          fs.unlinkSync(filePath);

          res.render('students/import', {
            success: true,
            message: `Import completed. Imported: ${result.data.imported}, Skipped: ${result.data.skipped}`,
            results: result.data
          });
        })
        .on('error', (error) => {
          fs.unlinkSync(filePath);
          throw error;
        });
    } catch (error) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error importing students:', error);
    res.render('students/import', {
      error: 'Failed to import students'
    });
  }
};

/**
 * Search students (API)
 */
exports.searchStudents = async (req, res) => {
  try {
    const { search } = req.query;

    const result = await studentService.getAllStudents({
      search: search || ''
    });

    res.json({
      success: result.success,
      data: result.data
    });
  } catch (error) {
    console.error('Error searching students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search students'
    });
  }
};
