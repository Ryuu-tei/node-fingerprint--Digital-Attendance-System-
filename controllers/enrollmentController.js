const enrollmentService = require('../services/enrollmentService');

/**
 * Enroll student in course (API)
 */
exports.enrollStudent = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    if (!studentId || !courseId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and course ID are required'
      });
    }

    const result = await enrollmentService.enrollStudent(
      studentId,
      courseId,
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
    console.error('Error enrolling student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enroll student'
    });
  }
};

/**
 * Unenroll student from course (API)
 */
exports.unenrollStudent = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    if (!studentId || !courseId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and course ID are required'
      });
    }

    const result = await enrollmentService.unenrollStudent(
      studentId,
      courseId,
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
      message: 'Student unenrolled successfully'
    });
  } catch (error) {
    console.error('Error unenrolling student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unenroll student'
    });
  }
};

/**
 * Get course enrollments (API)
 */
exports.getCourseEnrollments = async (req, res) => {
  try {
    const result = await enrollmentService.getCourseEnrollments(
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
    console.error('Error fetching enrollments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enrollments'
    });
  }
};

/**
 * Get student courses (API)
 */
exports.getStudentCourses = async (req, res) => {
  try {
    const result = await enrollmentService.getStudentCourses(
      req.params.studentId
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
    console.error('Error fetching student courses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courses'
    });
  }
};
