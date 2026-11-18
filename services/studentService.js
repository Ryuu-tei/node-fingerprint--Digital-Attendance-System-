const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');
const Fingerprint = require('../models/Fingerprint');
const { getFingerName } = require('../utils/fingerNames');

class StudentService {
  /**
   * Create a new student
   */
  async createStudent(studentData) {
    try {
      // Check if student ID already exists
      const existing = await Student.findOne({
        studentId: studentData.studentId
      });

      if (existing) {
        return {
          success: false,
          error: 'Student ID already exists'
        };
      }

      const student = new Student(studentData);
      await student.save();

      return {
        success: true,
        data: student
      };
    } catch (error) {
      console.error('Error creating student:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to create student'
      };
    }
  }

  /**
   * Get all students
   */
  async getAllStudents(filters = {}) {
    try {
      const query = { isActive: true };

      if (filters.search) {
        query.$or = [
          { studentId: { $regex: filters.search, $options: 'i' } },
          { firstName: { $regex: filters.search, $options: 'i' } },
          { lastName: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const students = await Student.find(query)
        .sort({ studentId: 1 })
        .lean();

      return {
        success: true,
        data: students,
        count: students.length
      };
    } catch (error) {
      console.error('Error fetching students:', error.message);
      return {
        success: false,
        error: 'Failed to fetch students'
      };
    }
  }

  /**
   * Get student by ID
   */
  async getStudentById(studentId) {
    try {
      const student = await Student.findById(studentId).lean();

      if (!student) {
        return {
          success: false,
          error: 'Student not found'
        };
      }

      return {
        success: true,
        data: student
      };
    } catch (error) {
      console.error('Error fetching student:', error.message);
      return {
        success: false,
        error: 'Failed to fetch student'
      };
    }
  }

  /**
   * Update student
   */
  async updateStudent(studentId, updateData) {
    try {
      // Don't allow studentId update
      delete updateData.studentId;

      const student = await Student.findByIdAndUpdate(
        studentId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!student) {
        return {
          success: false,
          error: 'Student not found'
        };
      }

      return {
        success: true,
        data: student
      };
    } catch (error) {
      console.error('Error updating student:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to update student'
      };
    }
  }

  /**
   * Delete student (soft delete)
   */
  async deleteStudent(studentId) {
    try {
      const student = await Student.findByIdAndUpdate(
        studentId,
        { isActive: false },
        { new: true }
      );

      if (!student) {
        return {
          success: false,
          error: 'Student not found'
        };
      }

      return {
        success: true,
        data: student
      };
    } catch (error) {
      console.error('Error deleting student:', error.message);
      return {
        success: false,
        error: 'Failed to delete student'
      };
    }
  }

  /**
   * Import students from CSV data
   */
  async importStudentsFromCSV(csvData) {
    try {
      const results = {
        imported: 0,
        skipped: 0,
        errors: []
      };

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];

        // Validate required fields
        if (!row.studentId || !row.firstName || !row.lastName) {
          results.errors.push({
            row: i + 1,
            error: 'Missing required fields: studentId, firstName, lastName'
          });
          results.skipped++;
          continue;
        }

        // Check for duplicate
        const existing = await Student.findOne({
          studentId: row.studentId
        });

        if (existing) {
          results.errors.push({
            row: i + 1,
            studentId: row.studentId,
            error: 'Student ID already exists'
          });
          results.skipped++;
          continue;
        }

        try {
          const student = new Student({
            studentId: row.studentId,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email || undefined,
            phone: row.phone || undefined
          });

          await student.save();
          results.imported++;
        } catch (err) {
          results.errors.push({
            row: i + 1,
            studentId: row.studentId,
            error: err.message
          });
          results.skipped++;
        }
      }

      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('Error importing students:', error.message);
      return {
        success: false,
        error: 'Failed to import students'
      };
    }
  }

  /**
   * Get student details with enrollment and fingerprint info
   */
  async getStudentDetails(studentId) {
    try {
      const student = await Student.findById(studentId).lean();

      if (!student) {
        return {
          success: false,
          error: 'Student not found'
        };
      }

      const enrollments = await Enrollment.find({
        student: studentId,
        status: 'active'
      })
        .populate('course', 'code name')
        .lean();

      const fingerprints = await Fingerprint.find({
        student: studentId,
        isActive: true
      })
        .select('fingerIndex createdAt')
        .lean();

      return {
        success: true,
        data: {
          ...student,
          enrollments,
          fingerprints: fingerprints.map(fingerprint => ({
            ...fingerprint,
            fingerName: getFingerName(fingerprint.fingerIndex)
          })),
          enrollmentCount: enrollments.length,
          fingerprintCount: fingerprints.length
        }
      };
    } catch (error) {
      console.error('Error fetching student details:', error.message);
      return {
        success: false,
        error: 'Failed to fetch student details'
      };
    }
  }
}

module.exports = new StudentService();
