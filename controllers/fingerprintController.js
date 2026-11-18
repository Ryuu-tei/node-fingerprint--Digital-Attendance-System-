const fingerprintService = require('../services/fingerprintService');
const studentService = require('../services/studentService');
const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');
const config = require('../config');
const { getFingerName } = require('../utils/fingerNames');

/**
 * Show fingerprint enrollment page
 */
exports.showEnrollmentPage = async (req, res) => {
  try {
    const result = await studentService.getAllStudents();

    res.render('fingerprint/enroll', {
      students: result.data,
      mockEnabled: config.fingerprint.mockEnabled
    });
  } catch (error) {
    console.error('Error showing enrollment page:', error);
    res.render('fingerprint/enroll', {
      error: 'Failed to load page',
      mockEnabled: config.fingerprint.mockEnabled
    });
  }
};

/**
 * Get fingerprint bridge info (API)
 */
exports.getBridgeInfo = async (req, res) => {
  try {
    const result = await fingerprintService.getBridgeInfo();

    res.json(result);
  } catch (error) {
    console.error('Error getting bridge info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bridge info'
    });
  }
};

/**
 * Capture fingerprint (API)
 */
exports.captureFingerprint = async (req, res) => {
  try {
    const { fingerIndex, studentId, forceMock } = req.body;

    if (fingerIndex === undefined || fingerIndex === null) {
      return res.status(400).json({
        success: false,
        error: 'Finger index is required'
      });
    }

    if (studentId && !forceMock) {
      const availability = await fingerprintService.assertFingerAvailable(
        studentId,
        fingerIndex
      );

      if (!availability.success) {
        return res.status(409).json({
          success: false,
          error: availability.error,
          code: availability.code
        });
      }
    }

    const result = await fingerprintService.captureFingerprint(fingerIndex, {
      mockStudentId: studentId,
      forceMock
    });

    res.json(result);
  } catch (error) {
    console.error('Error capturing fingerprint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to capture fingerprint'
    });
  }
};

/**
 * Stream fingerprint capture progress (API)
 */
exports.captureFingerprintStream = async (req, res) => {
  try {
    const { fingerIndex, studentId } = req.query;

    if (fingerIndex === undefined || fingerIndex === null || fingerIndex === '') {
      res.writeHead(400, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      });
      res.write(
        `data: ${JSON.stringify({
          event: 'done',
          success: false,
          error: 'Finger index is required'
        })}\n\n`
      );
      return res.end();
    }

    if (studentId) {
      const availability = await fingerprintService.assertFingerAvailable(
        studentId,
        fingerIndex
      );

      if (!availability.success) {
        res.writeHead(409, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        });
        res.write(
          `data: ${JSON.stringify({
            event: 'done',
            success: false,
            error: availability.error,
            code: availability.code
          })}\n\n`
        );
        return res.end();
      }
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });

    const upstream = await fingerprintService.openCaptureStream(fingerIndex, {
      mockStudentId: studentId
    });

    upstream.data.on('data', chunk => {
      res.write(chunk);
    });

    upstream.data.on('end', () => {
      res.end();
    });

    upstream.data.on('error', error => {
      res.write(
        `data: ${JSON.stringify({
          event: 'done',
          success: false,
          error: error.message || 'Fingerprint capture stream failed'
        })}\n\n`
      );
      res.end();
    });

    req.on('close', () => {
      upstream.data.destroy();
    });
  } catch (error) {
    console.error('Error streaming fingerprint capture:', error.message);

    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      });
    }

    res.write(
      `data: ${JSON.stringify({
        event: 'done',
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to stream fingerprint capture'
      })}\n\n`
    );
    res.end();
  }
};

/**
 * Enroll fingerprint for student (API)
 */
exports.enrollFingerprint = async (req, res) => {
  try {
    const { studentId, fingerIndex, templateData } = req.body;

    if (!studentId || fingerIndex === undefined || !templateData) {
      return res.status(400).json({
        success: false,
        error: 'Student ID, finger index, and template data are required'
      });
    }

    // Verify student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const result = await fingerprintService.enrollFingerprint(
      studentId,
      fingerIndex,
      templateData
    );

    if (result.success) {
      // Update student profile
      await Student.findByIdAndUpdate(
        studentId,
        { fingerprintEnrolled: true },
        { new: true }
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Error enrolling fingerprint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enroll fingerprint'
    });
  }
};

/**
 * Enroll a deterministic mock fingerprint for development/demo use.
 * This intentionally does not depend on the bridge, device driver, or .env mode.
 */
exports.mockEnrollFingerprint = async (req, res) => {
  try {
    const { studentId, fingerIndex } = req.body;

    if (!studentId || fingerIndex === undefined || fingerIndex === null) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and finger index are required'
      });
    }

    const numericFingerIndex = Number(fingerIndex);
    if (!Number.isInteger(numericFingerIndex) || numericFingerIndex < 0 || numericFingerIndex > 9) {
      return res.status(400).json({
        success: false,
        error: 'Finger index must be between 0 and 9'
      });
    }

    const availability = await fingerprintService.assertFingerAvailable(
      studentId,
      numericFingerIndex
    );

    if (!availability.success) {
      return res.status(409).json({
        success: false,
        error: availability.error,
        code: availability.code
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const templateData = `mock:${studentId}:${numericFingerIndex}:demo`;
    const result = await fingerprintService.enrollFingerprint(
      studentId,
      numericFingerIndex,
      templateData
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    await Student.findByIdAndUpdate(studentId, {
      fingerprintEnrolled: true
    });

    res.json({
      success: true,
      data: {
        ...result.data.toObject(),
        quality: 100,
        mock: true
      }
    });
  } catch (error) {
    console.error('Error mock enrolling fingerprint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mock enroll fingerprint'
    });
  }
};

/**
 * Get student fingerprints (API)
 */
exports.getStudentFingerprints = async (req, res) => {
  try {
    const result = await fingerprintService.getStudentFingerprints(
      req.params.studentId
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching fingerprints:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fingerprints'
    });
  }
};

/**
 * Delete fingerprint (API)
 */
exports.deleteFingerprint = async (req, res) => {
  try {
    const result = await fingerprintService.deleteFingerprint(
      req.params.fingerprintId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    const remaining = await fingerprintService.getStudentFingerprints(
      result.data.student
    );

    if (remaining.success && remaining.data.length === 0) {
      await Student.findByIdAndUpdate(result.data.student, {
        fingerprintEnrolled: false
      });
    }

    res.json({
      success: true,
      message: 'Fingerprint deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting fingerprint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete fingerprint'
    });
  }
};

/**
 * Capture and match fingerprint for attendance (API)
 * This is called during attendance marking
 */
exports.captureForAttendance = async (req, res) => {
  try {
    const { courseId, studentId, mockStudentId, forceMock } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    // Step 1: Capture fingerprint
    const captureResult = await fingerprintService.captureFingerprint(0, {
      mockStudentId,
      forceMock
    }); // Using finger 0 for scanning

    if (!captureResult.success) {
      return res.status(400).json({
        success: false,
        error: captureResult.error
      });
    }

    // Step 2: Verify the selected student when provided. Falling back to
    // course-wide identification keeps older clients working.
    const matchResult = studentId
      ? await fingerprintService.matchStudentInCourse(
          captureResult.data.templateData,
          courseId,
          studentId
        )
      : await fingerprintService.findMatchInCourse(
          captureResult.data.templateData,
          courseId
        );

    if (!matchResult.success) {
      return res.status(400).json({
        success: false,
        error: matchResult.error
      });
    }

    if (!matchResult.found) {
      return res.json({
        success: true,
        found: false,
        message: matchResult.data?.message || 'Fingerprint not recognized',
        match: {
          checkedCount: matchResult.data?.checkedCount || 0,
          enrolledFingerprintCount: matchResult.data?.enrolledFingerprintCount || 0,
          bestScore: matchResult.data?.bestScore || 0,
          bestConfidenceScore: matchResult.data?.bestConfidenceScore || 0,
          closest: matchResult.data?.closest
            ? {
                student: {
                  _id: matchResult.data.closest.student._id,
                  studentId: matchResult.data.closest.student.studentId,
                  firstName: matchResult.data.closest.student.firstName,
                  lastName: matchResult.data.closest.student.lastName
                },
                fingerIndex: matchResult.data.closest.fingerIndex,
                fingerName: matchResult.data.closest.fingerName,
                score: matchResult.data.closest.score,
                confidenceScore: matchResult.data.closest.confidenceScore
              }
            : null,
          selectedStudent: matchResult.data?.selectedStudent
            ? {
                _id: matchResult.data.selectedStudent._id,
                studentId: matchResult.data.selectedStudent.studentId,
                firstName: matchResult.data.selectedStudent.firstName,
                lastName: matchResult.data.selectedStudent.lastName
              }
            : null,
          threshold: matchResult.data?.threshold
        },
        capture: {
          quality: captureResult.data.quality,
          nfiq: captureResult.data.nfiq,
          device: captureResult.data.device,
          imageData: captureResult.data.imageData,
          imageMimeType: captureResult.data.imageMimeType
        }
      });
    }

    res.json({
      success: true,
      found: true,
      data: {
        student: {
          _id: matchResult.data.student._id,
          studentId: matchResult.data.student.studentId,
          firstName: matchResult.data.student.firstName,
          lastName: matchResult.data.student.lastName,
          email: matchResult.data.student.email
        },
        confidence: matchResult.data.confidenceScore,
        rawScore: matchResult.data.score,
        threshold: matchResult.data.threshold,
        fingerName: matchResult.data.fingerprint
          ? getFingerName(matchResult.data.fingerprint.fingerIndex)
          : null
      },
      capture: {
        quality: captureResult.data.quality,
        nfiq: captureResult.data.nfiq,
        device: captureResult.data.device,
        imageData: captureResult.data.imageData,
        imageMimeType: captureResult.data.imageMimeType
      }
    });
  } catch (error) {
    console.error('Error capturing for attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to capture fingerprint'
    });
  }
};

/**
 * Match an already captured template for attendance (API)
 * Used by the live capture stream flow.
 */
exports.matchForAttendance = async (req, res) => {
  try {
    const { courseId, studentId, templateData } = req.body;

    if (!courseId || !templateData) {
      return res.status(400).json({
        success: false,
        error: 'Course ID and template data are required'
      });
    }

    const matchResult = studentId
      ? await fingerprintService.matchStudentInCourse(templateData, courseId, studentId)
      : await fingerprintService.findMatchInCourse(templateData, courseId);

    if (!matchResult.success) {
      return res.status(400).json({
        success: false,
        error: matchResult.error
      });
    }

    if (!matchResult.found) {
      return res.json({
        success: true,
        found: false,
        message: matchResult.data?.message || 'Fingerprint not recognized',
        match: {
          checkedCount: matchResult.data?.checkedCount || 0,
          enrolledFingerprintCount: matchResult.data?.enrolledFingerprintCount || 0,
          bestScore: matchResult.data?.bestScore || 0,
          bestConfidenceScore: matchResult.data?.bestConfidenceScore || 0,
          closest: matchResult.data?.closest
            ? {
                student: {
                  _id: matchResult.data.closest.student._id,
                  studentId: matchResult.data.closest.student.studentId,
                  firstName: matchResult.data.closest.student.firstName,
                  lastName: matchResult.data.closest.student.lastName
                },
                fingerIndex: matchResult.data.closest.fingerIndex,
                fingerName: matchResult.data.closest.fingerName,
                score: matchResult.data.closest.score,
                confidenceScore: matchResult.data.closest.confidenceScore
              }
            : null,
          selectedStudent: matchResult.data?.selectedStudent
            ? {
                _id: matchResult.data.selectedStudent._id,
                studentId: matchResult.data.selectedStudent.studentId,
                firstName: matchResult.data.selectedStudent.firstName,
                lastName: matchResult.data.selectedStudent.lastName
              }
            : null,
          threshold: matchResult.data?.threshold
        }
      });
    }

    res.json({
      success: true,
      found: true,
      data: {
        student: {
          _id: matchResult.data.student._id,
          studentId: matchResult.data.student.studentId,
          firstName: matchResult.data.student.firstName,
          lastName: matchResult.data.student.lastName,
          email: matchResult.data.student.email
        },
        confidence: matchResult.data.confidenceScore,
        rawScore: matchResult.data.score,
        threshold: matchResult.data.threshold,
        fingerName: matchResult.data.fingerprint
          ? getFingerName(matchResult.data.fingerprint.fingerIndex)
          : null
      }
    });
  } catch (error) {
    console.error('Error matching for attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to match fingerprint'
    });
  }
};

/**
 * Simulate fingerprint capture for attendance for a selected student.
 * This is a reliable demo path while the real MELO31 SDK is being installed.
 */
exports.mockCaptureForAttendance = async (req, res) => {
  try {
    const { courseId, studentId } = req.body;

    if (!courseId || !studentId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID and student ID are required'
      });
    }

    const enrollment = await Enrollment.findOne({
      course: courseId,
      student: studentId,
      status: 'active'
    }).populate('student');

    if (!enrollment || !enrollment.student) {
      return res.status(400).json({
        success: false,
        found: false,
        error: 'Selected student is not enrolled in this course'
      });
    }

    const fingerprints = await fingerprintService.getStudentFingerprints(studentId);
    if (!fingerprints.success || fingerprints.data.length === 0) {
      return res.json({
        success: true,
        found: false,
        message: 'No mock fingerprint enrolled for this student'
      });
    }

    res.json({
      success: true,
      found: true,
      data: {
        student: {
          _id: enrollment.student._id,
          studentId: enrollment.student.studentId,
          firstName: enrollment.student.firstName,
          lastName: enrollment.student.lastName,
          email: enrollment.student.email
        },
        confidence: 100
      }
    });
  } catch (error) {
    console.error('Error mock capturing for attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate fingerprint attendance'
    });
  }
};
