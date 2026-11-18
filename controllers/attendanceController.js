const attendanceService = require('../services/attendanceService');
const courseService = require('../services/courseService');

/**
 * Show attendance sessions list for course
 */
exports.showSessionsList = async (req, res) => {
  try {
    const courseResult = await courseService.getCourseById(
      req.params.courseId,
      req.lecturerId
    );

    if (!courseResult.success) {
      return res.status(404).render('error', {
        message: courseResult.error
      });
    }

    const sessionsResult = await attendanceService.getCourseSessions(
      req.params.courseId,
      req.lecturerId
    );

    res.render('attendance/sessions-list', {
      course: courseResult.data,
      sessions: sessionsResult.data || []
    });
  } catch (error) {
    console.error('Error showing sessions:', error);
    res.render('error', {
      message: 'Failed to load sessions'
    });
  }
};

/**
 * Get attendance sessions for a course (API)
 */
exports.getCourseSessions = async (req, res) => {
  try {
    const result = await attendanceService.getCourseSessions(
      req.params.courseId,
      req.lecturerId
    );

    if (!result.success) {
      return res.status(result.code === 'ATTENDANCE_ALREADY_MARKED' ? 409 : 400).json({
        success: false,
        error: result.error,
        code: result.code,
        data: result.data
      });
    }

    res.json({
      success: true,
      data: result.data,
      count: result.count
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions'
    });
  }
};

/**
 * Show create session page
 */
exports.showCreateSession = async (req, res) => {
  try {
    const courseResult = await courseService.getCourseById(
      req.params.courseId,
      req.lecturerId
    );

    if (!courseResult.success) {
      return res.status(404).render('error', {
        message: courseResult.error
      });
    }

    res.render('attendance/create-session', {
      course: courseResult.data
    });
  } catch (error) {
    console.error('Error showing create session:', error);
    res.render('error', {
      message: 'Failed to load page'
    });
  }
};

/**
 * Create attendance session (API)
 */
exports.createSession = async (req, res) => {
  try {
    const result = await attendanceService.createSession(
      req.body,
      req.params.courseId,
      req.lecturerId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
        data: result.data
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
};

/**
 * Show mark attendance page
 */
exports.showMarkAttendance = async (req, res) => {
  try {
    const sessionResult = await attendanceService.getSessionDetails(
      req.params.sessionId,
      req.lecturerId
    );

    if (!sessionResult.success) {
      return res.status(404).render('error', {
        message: sessionResult.error
      });
    }

    const course = sessionResult.data.course;

    res.render('attendance/mark-attendance', {
      session: sessionResult.data,
      course
    });
  } catch (error) {
    console.error('Error showing mark attendance:', error);
    res.render('error', {
      message: 'Failed to load page'
    });
  }
};

/**
 * Mark attendance (API)
 */
exports.markAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { studentId, status, markedBy = 'manual', confidenceScore } = req.body;

    if (!studentId || !status) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and status are required'
      });
    }

    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be present or absent'
      });
    }

    const result = await attendanceService.markAttendance(
      sessionId,
      studentId,
      status,
      markedBy,
      {
        confidenceScore,
        fingerUsed: markedBy === 'biometric'
      }
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
        data: result.data
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark attendance'
    });
  }
};

/**
 * Override attendance (API)
 */
exports.overrideAttendance = async (req, res) => {
  try {
    const { sessionId, studentId, status } = req.body;

    if (!sessionId || !studentId || !status) {
      return res.status(400).json({
        success: false,
        error: 'Session ID, student ID, and status are required'
      });
    }

    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be present or absent'
      });
    }

    const result = await attendanceService.overrideAttendance(
      sessionId,
      studentId,
      status,
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
    console.error('Error overriding attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to override attendance'
    });
  }
};

/**
 * Close session (API)
 */
exports.closeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await attendanceService.closeSession(sessionId, req.lecturerId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Session closed successfully',
      data: result.data
    });
  } catch (error) {
    console.error('Error closing session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close session'
    });
  }
};

/**
 * Get session records (API)
 */
exports.getSessionRecords = async (req, res) => {
  try {
    const result = await attendanceService.getSessionRecords(
      req.params.sessionId,
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
    console.error('Error fetching records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch records'
    });
  }
};
