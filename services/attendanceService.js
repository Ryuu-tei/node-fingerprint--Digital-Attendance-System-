const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');

class AttendanceService {
  minutesFromTime(time) {
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(String(time || ''))) {
      return null;
    }

    const [hours, minutes] = String(time).split(':').map(Number);
    return hours * 60 + minutes;
  }

  normalizeDateOnly(dateValue) {
    if (!dateValue) {
      return null;
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setHours(0, 0, 0, 0);
    return date;
  }

  validateSessionData(sessionData) {
    const sessionDate = this.normalizeDateOnly(sessionData.sessionDate);
    if (!sessionDate) {
      return 'A valid session date is required';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (sessionDate < today) {
      return 'Session date cannot be in the past';
    }

    const startMinutes = this.minutesFromTime(sessionData.startTime);
    const endMinutes = this.minutesFromTime(sessionData.endTime);

    if (startMinutes === null) {
      return 'Start time must be in HH:MM format';
    }

    if (endMinutes === null) {
      return 'End time must be in HH:MM format';
    }

    if (endMinutes <= startMinutes) {
      return 'End time must be after start time';
    }

    return null;
  }

  sessionsOverlap(firstStart, firstEnd, secondStart, secondEnd) {
    return firstStart < secondEnd && secondStart < firstEnd;
  }

  normalizeConfidenceScore(score) {
    if (score === undefined || score === null || score === '') {
      return null;
    }

    const numericScore = Number(score);
    if (!Number.isFinite(numericScore)) {
      return null;
    }

    if (numericScore <= 100) {
      return Math.max(0, Math.min(100, Math.round(numericScore)));
    }

    return Math.max(0, Math.min(100, Math.round(numericScore / 10)));
  }

  /**
   * Create attendance session
   */
  async createSession(sessionData, courseId, lecturerId) {
    try {
      const validationError = this.validateSessionData(sessionData);
      if (validationError) {
        return {
          success: false,
          error: validationError
        };
      }

      // Verify course exists and belongs to lecturer
      const course = await Course.findOne({
        _id: courseId,
        lecturer: lecturerId
      });

      if (!course) {
        return {
          success: false,
          error: 'Course not found or unauthorized'
        };
      }

      const sessionDate = this.normalizeDateOnly(sessionData.sessionDate);
      const startMinutes = this.minutesFromTime(sessionData.startTime);
      const endMinutes = this.minutesFromTime(sessionData.endTime);
      const nextDay = new Date(sessionDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const sameDaySessions = await AttendanceSession.find({
        course: courseId,
        sessionDate: {
          $gte: sessionDate,
          $lt: nextDay
        }
      }).lean();

      const overlappingSession = sameDaySessions.find(session =>
        this.sessionsOverlap(
          startMinutes,
          endMinutes,
          this.minutesFromTime(session.startTime),
          this.minutesFromTime(session.endTime)
        )
      );

      if (overlappingSession) {
        return {
          success: false,
          error: `This session overlaps an existing ${overlappingSession.startTime} - ${overlappingSession.endTime} session`
        };
      }

      const session = new AttendanceSession({
        ...sessionData,
        sessionDate,
        course: courseId,
        status: 'open'
      });

      await session.save();
      await session.populate('course');

      return {
        success: true,
        data: session
      };
    } catch (error) {
      console.error('Error creating session:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to create session'
      };
    }
  }

  /**
   * Get sessions for a course
   */
  async getCourseSessions(courseId, lecturerId = null) {
    try {
      if (lecturerId) {
        const course = await Course.findOne({
          _id: courseId,
          lecturer: lecturerId
        });

        if (!course) {
          return {
            success: false,
            error: 'Course not found or unauthorized'
          };
        }
      }

      const sessions = await AttendanceSession.find({
        course: courseId
      })
        .sort({ sessionDate: -1 })
        .lean();

      const [activeEnrollmentCount, records] = await Promise.all([
        Enrollment.countDocuments({
          course: courseId,
          status: 'active'
        }),
        AttendanceRecord.find({
          session: { $in: sessions.map(session => session._id) }
        })
          .select('session status')
          .lean()
      ]);

      const statsBySession = new Map();
      records.forEach(record => {
        const sessionKey = record.session.toString();
        const stats = statsBySession.get(sessionKey) || {
          presentCount: 0,
          absentCount: 0
        };

        if (record.status === 'present') {
          stats.presentCount++;
        } else if (record.status === 'absent') {
          stats.absentCount++;
        }

        statsBySession.set(sessionKey, stats);
      });

      const sessionsWithStats = sessions.map(session => {
        const stats = statsBySession.get(session._id.toString()) || {
          presentCount: 0,
          absentCount: 0
        };
        const markedCount = stats.presentCount + stats.absentCount;

        return {
          ...session,
          totalStudents: activeEnrollmentCount,
          presentCount: stats.presentCount,
          absentCount: stats.absentCount,
          markedCount,
          unmarkedCount: Math.max(activeEnrollmentCount - markedCount, 0)
        };
      });

      return {
        success: true,
        data: sessionsWithStats,
        count: sessions.length
      };
    } catch (error) {
      console.error('Error fetching sessions:', error.message);
      return {
        success: false,
        error: 'Failed to fetch sessions'
      };
    }
  }

  /**
   * Get session details with attendance records
   */
  async getSessionDetails(sessionId, lecturerId = null) {
    try {
      const session = await AttendanceSession.findById(sessionId).populate('course');

      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      if (lecturerId && session.course.lecturer.toString() !== lecturerId) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      const records = await AttendanceRecord.find({
        session: sessionId
      })
        .populate('student')
        .lean();

      return {
        success: true,
        data: {
          ...session.toObject(),
          records,
          totalRecords: records.length,
          presentCount: records.filter(r => r.status === 'present').length,
          absentCount: records.filter(r => r.status === 'absent').length
        }
      };
    } catch (error) {
      console.error('Error fetching session details:', error.message);
      return {
        success: false,
        error: 'Failed to fetch session details'
      };
    }
  }

  /**
   * Mark attendance (manual or biometric)
   */
  async markAttendance(
    sessionId,
    studentId,
    status,
    markedBy = 'manual',
    additionalData = {}
  ) {
    try {
      // Verify student is enrolled in course
      const session = await AttendanceSession.findById(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      if (session.status !== 'open') {
        return {
          success: false,
          error: 'Attendance session is closed'
        };
      }

      const enrollment = await Enrollment.findOne({
        student: studentId,
        course: session.course,
        status: 'active'
      });

      if (!enrollment) {
        return {
          success: false,
          error: 'Student not enrolled in this course'
        };
      }

      // Check if already marked
      const existing = await AttendanceRecord.findOne({
        session: sessionId,
        student: studentId
      });

      if (existing) {
        await existing.populate('student');

        return {
          success: false,
          code: 'ATTENDANCE_ALREADY_MARKED',
          error: `${existing.student.firstName} ${existing.student.lastName} is already marked ${existing.status} for this session`,
          data: existing
        };
      }

      // Create attendance record
      const record = new AttendanceRecord({
        session: sessionId,
        student: studentId,
        status: status,
        markedBy: markedBy,
        confidenceScore: this.normalizeConfidenceScore(additionalData.confidenceScore),
        fingerUsed: additionalData.fingerUsed || false,
        notes: additionalData.notes || ''
      });

      await record.save();
      await record.populate('student');

      return {
        success: true,
        data: record
      };
    } catch (error) {
      console.error('Error marking attendance:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to mark attendance'
      };
    }
  }

  /**
   * Override manual attendance
   */
  async overrideAttendance(sessionId, studentId, newStatus, lecturerId) {
    try {
      // Verify course ownership
      const session = await AttendanceSession.findById(sessionId).populate('course');

      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      if (session.status !== 'open') {
        return {
          success: false,
          error: 'Attendance session is closed'
        };
      }

      if (session.course.lecturer.toString() !== lecturerId) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      const enrollment = await Enrollment.findOne({
        student: studentId,
        course: session.course._id,
        status: 'active'
      });

      if (!enrollment) {
        return {
          success: false,
          error: 'Student not enrolled in this course'
        };
      }

      let record = await AttendanceRecord.findOneAndUpdate(
        {
          session: sessionId,
          student: studentId
        },
        {
          status: newStatus,
          markedBy: 'manual',
          notes: 'Manually overridden'
        },
        { new: true }
      ).populate('student');

      if (!record) {
        record = new AttendanceRecord({
          session: sessionId,
          student: studentId,
          status: newStatus,
          markedBy: 'manual',
          notes: 'Manually marked'
        });
        await record.save();
        await record.populate('student');
      }

      return {
        success: true,
        data: record
      };
    } catch (error) {
      console.error('Error overriding attendance:', error.message);
      return {
        success: false,
        error: 'Failed to override attendance'
      };
    }
  }

  /**
   * Close attendance session
   */
  async closeSession(sessionId, lecturerId) {
    try {
      const session = await AttendanceSession.findById(sessionId).populate('course');

      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      if (session.course.lecturer.toString() !== lecturerId) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      const [enrollments, existingRecords] = await Promise.all([
        Enrollment.find({
          course: session.course._id,
          status: 'active'
        }).select('student'),
        AttendanceRecord.find({
          session: sessionId
        }).select('student')
      ]);

      const markedStudentIds = new Set(
        existingRecords.map(record => record.student.toString())
      );

      const absentRecords = enrollments
        .filter(enrollment => !markedStudentIds.has(enrollment.student.toString()))
        .map(enrollment => ({
          session: sessionId,
          student: enrollment.student,
          status: 'absent',
          markedBy: 'manual',
          fingerUsed: false,
          notes: 'Automatically marked absent when session closed'
        }));

      if (absentRecords.length > 0) {
        await AttendanceRecord.insertMany(absentRecords, { ordered: false });
      }

      session.status = 'closed';
      await session.save();

      return {
        success: true,
        data: {
          session,
          autoAbsentCount: absentRecords.length
        }
      };
    } catch (error) {
      console.error('Error closing session:', error.message);
      return {
        success: false,
        error: 'Failed to close session'
      };
    }
  }

  /**
   * Get attendance records for a session
   */
  async getSessionRecords(sessionId, lecturerId = null) {
    try {
      const session = await AttendanceSession.findById(sessionId).populate('course');

      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      if (lecturerId && session.course.lecturer.toString() !== lecturerId) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      const [records, enrollments] = await Promise.all([
        AttendanceRecord.find({ session: sessionId })
        .populate('student')
        .sort({ createdAt: 1 })
          .lean(),
        Enrollment.find({
          course: session.course._id,
          status: 'active'
        })
          .populate('student')
          .sort({ createdAt: 1 })
          .lean()
      ]);

      const recordByStudent = new Map(
        records
          .filter(record => record.student)
          .map(record => [record.student._id.toString(), record])
      );

      const roster = enrollments
        .filter(enrollment => enrollment.student)
        .map(enrollment => {
          const record = recordByStudent.get(enrollment.student._id.toString());

          if (record) {
            return record;
          }

          return {
            _id: null,
            session: sessionId,
            student: enrollment.student,
            status: 'unmarked',
            markedBy: null,
            confidenceScore: null,
            fingerUsed: false,
            notes: ''
          };
        });

      return {
        success: true,
        data: roster
      };
    } catch (error) {
      console.error('Error fetching records:', error.message);
      return {
        success: false,
        error: 'Failed to fetch attendance records'
      };
    }
  }
}

module.exports = new AttendanceService();
