const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');

class CourseService {
  /**
   * Create a new course
   */
  async createCourse(courseData, lecturerId) {
    try {
      // Check if code already exists
      const existing = await Course.findOne({
        code: courseData.code
      });

      if (existing) {
        return {
          success: false,
          error: 'Course code already exists'
        };
      }

      courseData.lecturer = lecturerId;
      const course = new Course(courseData);
      await course.save();

      return {
        success: true,
        data: course
      };
    } catch (error) {
      console.error('Error creating course:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to create course'
      };
    }
  }

  /**
   * Get all courses for a lecturer
   */
  async getCoursesByLecturer(lecturerId, filters = {}) {
    try {
      const query = {
        lecturer: lecturerId,
        isActive: true
      };

      if (filters.search) {
        query.$or = [
          { code: { $regex: filters.search, $options: 'i' } },
          { name: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const courses = await Course.find(query)
        .populate('lecturer', 'fullName email')
        .sort({ code: 1 })
        .lean();

      return {
        success: true,
        data: courses,
        count: courses.length
      };
    } catch (error) {
      console.error('Error fetching courses:', error.message);
      return {
        success: false,
        error: 'Failed to fetch courses'
      };
    }
  }

  /**
   * Get course by ID
   */
  async getCourseById(courseId, lecturerId = null) {
    try {
      const query = { _id: courseId };

      // If lecturerId provided, verify ownership
      if (lecturerId) {
        query.lecturer = lecturerId;
      }

      const course = await Course.findOne(query)
        .populate('lecturer', 'fullName email')
        .lean();

      if (!course) {
        return {
          success: false,
          error: 'Course not found'
        };
      }

      // Get enrollment count
      const enrollmentCount = await Enrollment.countDocuments({
        course: courseId,
        status: 'active'
      });

      return {
        success: true,
        data: {
          ...course,
          enrollmentCount
        }
      };
    } catch (error) {
      console.error('Error fetching course:', error.message);
      return {
        success: false,
        error: 'Failed to fetch course'
      };
    }
  }

  /**
   * Update course
   */
  async updateCourse(courseId, updateData, lecturerId) {
    try {
      // Don't allow code change, verify lecturer ownership
      delete updateData.code;
      delete updateData.lecturer;

      const course = await Course.findOneAndUpdate(
        { _id: courseId, lecturer: lecturerId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!course) {
        return {
          success: false,
          error: 'Course not found or unauthorized'
        };
      }

      return {
        success: true,
        data: course
      };
    } catch (error) {
      console.error('Error updating course:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to update course'
      };
    }
  }

  /**
   * Delete course (cascade delete enrollments and sessions)
   */
  async deleteCourse(courseId, lecturerId) {
    try {
      const session = await Course.startSession();
      session.startTransaction();

      try {
        // Verify course exists and belongs to lecturer
        const course = await Course.findOne({
          _id: courseId,
          lecturer: lecturerId
        });

        if (!course) {
          await session.abortTransaction();
          return {
            success: false,
            error: 'Course not found or unauthorized'
          };
        }

        // Delete all attendance records for this course
        const sessions = await AttendanceSession.find({
          course: courseId
        });

        const sessionIds = sessions.map(s => s._id);
        await AttendanceRecord.deleteMany({
          session: { $in: sessionIds }
        });

        // Delete attendance sessions
        await AttendanceSession.deleteMany({
          course: courseId
        });

        // Delete enrollments
        await Enrollment.deleteMany({
          course: courseId
        });

        // Soft delete course
        const deletedCourse = await Course.findByIdAndUpdate(
          courseId,
          { isActive: false },
          { new: true }
        );

        await session.commitTransaction();

        return {
          success: true,
          data: deletedCourse
        };
      } catch (error) {
        await session.abortTransaction();
        throw error;
      }
    } catch (error) {
      console.error('Error deleting course:', error.message);
      return {
        success: false,
        error: 'Failed to delete course'
      };
    }
  }

  /**
   * Get course students (enrolled only)
   */
  async getCourseStudents(courseId, lecturerId = null) {
    try {
      const query = { _id: courseId };
      if (lecturerId) {
        query.lecturer = lecturerId;
      }

      const course = await Course.findOne(query);
      if (!course) {
        return {
          success: false,
          error: 'Course not found'
        };
      }

      const enrollments = await Enrollment.find({
        course: courseId,
        status: 'active'
      })
        .populate('student')
        .lean();

      const students = enrollments.map(e => e.student);

      return {
        success: true,
        data: students,
        count: students.length
      };
    } catch (error) {
      console.error('Error fetching course students:', error.message);
      return {
        success: false,
        error: 'Failed to fetch course students'
      };
    }
  }
}

module.exports = new CourseService();
