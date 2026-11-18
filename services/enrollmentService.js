const Enrollment = require('../models/Enrollment');
const Student = require('../models/Student');
const Course = require('../models/Course');

class EnrollmentService {
  /**
   * Enroll a student in a course
   */
  async enrollStudent(studentId, courseId, lecturerId) {
    try {
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

      // Verify student exists
      const student = await Student.findById(studentId);
      if (!student) {
        return {
          success: false,
          error: 'Student not found'
        };
      }

      // Check if already enrolled
      const existing = await Enrollment.findOne({
        student: studentId,
        course: courseId
      });

      if (existing && existing.status === 'active') {
        return {
          success: false,
          error: 'Student is already enrolled in this course'
        };
      }

      let enrollment;
      if (existing) {
        // Reactivate if dropped
        existing.status = 'active';
        enrollment = await existing.save();
      } else {
        // Create new enrollment
        enrollment = new Enrollment({
          student: studentId,
          course: courseId,
          status: 'active'
        });
        enrollment = await enrollment.save();
      }

      // Populate for response
      enrollment = await enrollment.populate(['student', 'course']);

      return {
        success: true,
        data: enrollment
      };
    } catch (error) {
      console.error('Error enrolling student:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to enroll student'
      };
    }
  }

  /**
   * Get all students enrolled in a course
   */
  async getCourseEnrollments(courseId, lecturerId = null) {
    try {
      // Verify course exists
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

      const enrollments = await Enrollment.find({
        course: courseId,
        status: 'active'
      })
        .populate('student')
        .sort({ createdAt: 1 })
        .lean();

      return {
        success: true,
        data: enrollments,
        count: enrollments.length
      };
    } catch (error) {
      console.error('Error fetching enrollments:', error.message);
      return {
        success: false,
        error: 'Failed to fetch enrollments'
      };
    }
  }

  /**
   * Remove student from course
   */
  async unenrollStudent(studentId, courseId, lecturerId) {
    try {
      // Verify course ownership
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

      const enrollment = await Enrollment.findOneAndUpdate(
        {
          student: studentId,
          course: courseId
        },
        { status: 'dropped' },
        { new: true }
      );

      if (!enrollment) {
        return {
          success: false,
          error: 'Enrollment not found'
        };
      }

      return {
        success: true,
        data: enrollment
      };
    } catch (error) {
      console.error('Error unenrolling student:', error.message);
      return {
        success: false,
        error: 'Failed to unenroll student'
      };
    }
  }

  /**
   * Get courses for a student
   */
  async getStudentCourses(studentId) {
    try {
      const enrollments = await Enrollment.find({
        student: studentId,
        status: 'active'
      })
        .populate('course')
        .sort({ createdAt: -1 })
        .lean();

      const courses = enrollments.map(e => e.course);

      return {
        success: true,
        data: courses,
        count: courses.length
      };
    } catch (error) {
      console.error('Error fetching student courses:', error.message);
      return {
        success: false,
        error: 'Failed to fetch student courses'
      };
    }
  }

  /**
   * Check if student is enrolled in course
   */
  async isStudentEnrolled(studentId, courseId) {
    try {
      const enrollment = await Enrollment.findOne({
        student: studentId,
        course: courseId,
        status: 'active'
      });

      return {
        success: true,
        enrolled: !!enrollment
      };
    } catch (error) {
      console.error('Error checking enrollment:', error.message);
      return {
        success: false,
        error: 'Failed to check enrollment'
      };
    }
  }
}

module.exports = new EnrollmentService();
