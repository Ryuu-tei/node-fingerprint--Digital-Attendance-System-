const courseService = require('../services/courseService');
const enrollmentService = require('../services/enrollmentService');

/**
 * Show courses list page
 */
exports.showCoursesList = async (req, res) => {
  try {
    const result = await courseService.getCoursesByLecturer(req.lecturerId);

    res.render('courses/list', {
      courses: result.data,
      count: result.count
    });
  } catch (error) {
    console.error('Error showing courses list:', error);
    res.render('courses/list', {
      error: 'Failed to load courses'
    });
  }
};

/**
 * Show create course page
 */
exports.showCreateCourse = (req, res) => {
  res.render('courses/create');
};

/**
 * Create course
 */
exports.createCourse = async (req, res) => {
  try {
    const result = await courseService.createCourse(
      req.body,
      req.lecturerId
    );

    if (!result.success) {
      return res.render('courses/create', {
        error: result.error
      });
    }

    res.redirect('/courses?message=Course created successfully');
  } catch (error) {
    console.error('Error creating course:', error);
    res.render('courses/create', {
      error: 'Failed to create course'
    });
  }
};

/**
 * Show course details
 */
exports.showCourseDetail = async (req, res) => {
  try {
    const result = await courseService.getCourseById(
      req.params.id,
      req.lecturerId
    );

    if (!result.success) {
      return res.status(404).render('error', {
        message: result.error
      });
    }

    res.render('courses/detail', {
      course: result.data
    });
  } catch (error) {
    console.error('Error showing course details:', error);
    res.render('error', {
      message: 'Failed to load course'
    });
  }
};

/**
 * Update course
 */
exports.updateCourse = async (req, res) => {
  try {
    const result = await courseService.updateCourse(
      req.params.id,
      req.body,
      req.lecturerId
    );

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
    console.error('Error updating course:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update course'
    });
  }
};

/**
 * Delete course
 */
exports.deleteCourse = async (req, res) => {
  try {
    const result = await courseService.deleteCourse(
      req.params.id,
      req.lecturerId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete course'
    });
  }
};

/**
 * Get course students
 */
exports.getCourseStudents = async (req, res) => {
  try {
    const result = await courseService.getCourseStudents(
      req.params.courseId,
      req.lecturerId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      count: result.count
    });
  } catch (error) {
    console.error('Error fetching course students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students'
    });
  }
};

/**
 * Show manage students page
 */
exports.showManageStudents = async (req, res) => {
  try {
    const courseResult = await courseService.getCourseById(
      req.params.id,
      req.lecturerId
    );

    if (!courseResult.success) {
      return res.status(404).render('error', {
        message: courseResult.error
      });
    }

    const enrollmentsResult = await enrollmentService.getCourseEnrollments(
      req.params.id,
      req.lecturerId
    );

    res.render('courses/manage-students', {
      course: courseResult.data,
      enrollments: enrollmentsResult.data || []
    });
  } catch (error) {
    console.error('Error showing manage students:', error);
    res.render('error', {
      message: 'Failed to load page'
    });
  }
};
