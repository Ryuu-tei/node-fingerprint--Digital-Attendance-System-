const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceSession = require('../models/AttendanceSession');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');

class ReportService {
  /**
   * Generate course attendance report
   */
  async generateCourseReport(courseId, lecturerId) {
    try {
      // Verify course exists and belongs to lecturer
      const course = await Course.findOne({
        _id: courseId,
        lecturer: lecturerId
      }).lean();

      if (!course) {
        return {
          success: false,
          error: 'Course not found or unauthorized'
        };
      }

      // Get all enrollments for course
      const enrollments = await Enrollment.find({
        course: courseId,
        status: 'active'
      })
        .populate('student')
        .lean();

      // Get all sessions for course
      const sessions = await AttendanceSession.find({
        course: courseId
      })
        .sort({ sessionDate: 1 })
        .lean();

      // Get all attendance records
      const records = await AttendanceRecord.find({
        session: { $in: sessions.map(s => s._id) }
      }).lean();

      // Build report data
      const report = {
        course: {
          _id: course._id,
          code: course.code,
          name: course.name,
          semester: course.semester
        },
        sessions: sessions.length,
        sessionList: sessions.map((session, index) => ({
          id: session._id,
          label: `Session ${index + 1}`
        })),
        students: enrollments.length,
        data: []
      };

      // For each student, track attendance
      for (const enrollment of enrollments) {
        const studentData = {
          studentId: enrollment.student.studentId,
          name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          email: enrollment.student.email || 'N/A',
          attendance: {}
        };

        // Track attendance for each session
        for (const session of sessions) {
          const record = records.find(
            r =>
              r.student.toString() === enrollment.student._id.toString() &&
              r.session.toString() === session._id.toString()
          );

          studentData.attendance[session._id.toString()] = record
            ? record.status === 'present'
              ? 'P'
              : 'A'
            : 'A';
        }

        report.data.push(studentData);
      }

      return {
        success: true,
        data: report
      };
    } catch (error) {
      console.error('Error generating course report:', error.message);
      return {
        success: false,
        error: 'Failed to generate report'
      };
    }
  }

  /**
   * Generate CSV data for export
   */
  async generateCourseReportCSV(courseId, lecturerId) {
    try {
      const reportResult = await this.generateCourseReport(courseId, lecturerId);

      if (!reportResult.success) {
        return reportResult;
      }

      const report = reportResult.data;
      const rows = [];

      // Header row
      const course = report.course;
      rows.push(`Course Report: ${course.code} - ${course.name}`);
      rows.push(`Semester: ${course.semester}`);
      rows.push('');

      const headers = ['Student ID', 'Name', 'Email'];
      headers.push(...report.sessionList.map(session => session.label));

      rows.push(headers.map(this.escapeCSVValue).join(','));

      // Data rows
      for (const student of report.data) {
        const row = [student.studentId, student.name, student.email];
        const attendanceValues = Object.values(student.attendance);
        row.push(...attendanceValues);
        rows.push(row.map(this.escapeCSVValue).join(','));
      }

      const csv = rows.join('\n');

      return {
        success: true,
        data: csv
      };
    } catch (error) {
      console.error('Error generating CSV:', error.message);
      return {
        success: false,
        error: 'Failed to generate CSV report'
      };
    }
  }

  /**
   * Get student attendance statistics
   */
  async getStudentStatistics(studentId, courseId) {
    try {
      // Get all sessions for course
      const sessions = await AttendanceSession.find({
        course: courseId
      }).lean();

      // Get attendance records
      const records = await AttendanceRecord.find({
        student: studentId,
        session: { $in: sessions.map(s => s._id) }
      }).lean();

      const presentCount = records.filter(r => r.status === 'present').length;
      const absentCount = records.filter(r => r.status === 'absent').length;
      const totalSessions = sessions.length;
      const unrecordedSessions = totalSessions - (presentCount + absentCount);
      const attendancePercentage =
        totalSessions > 0 ? ((presentCount / totalSessions) * 100).toFixed(2) : 0;

      return {
        success: true,
        data: {
          totalSessions,
          present: presentCount,
          absent: absentCount,
          unrecorded: unrecordedSessions,
          attendancePercentage: parseFloat(attendancePercentage)
        }
      };
    } catch (error) {
      console.error('Error calculating statistics:', error.message);
      return {
        success: false,
        error: 'Failed to calculate statistics'
      };
    }
  }

  /**
   * Get course statistics
   */
  async getCourseStatistics(courseId, lecturerId) {
    try {
      // Verify course
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

      const sessions = await AttendanceSession.find({
        course: courseId
      }).lean();

      const enrollments = await Enrollment.countDocuments({
        course: courseId,
        status: 'active'
      });

      const records = await AttendanceRecord.find({
        session: { $in: sessions.map(s => s._id) }
      }).lean();

      const presentCount = records.filter(r => r.status === 'present').length;
      const absentCount = records.filter(r => r.status === 'absent').length;

      return {
        success: true,
        data: {
          totalStudents: enrollments,
          totalSessions: sessions.length,
          totalMarkings: records.length,
          presentMarkings: presentCount,
          absentMarkings: absentCount,
          avgAttendancePercentage:
            records.length > 0
              ? ((presentCount / records.length) * 100).toFixed(2)
              : 0
        }
      };
    } catch (error) {
      console.error('Error calculating course statistics:', error.message);
      return {
        success: false,
        error: 'Failed to calculate statistics'
      };
    }
  }

  /**
   * Generate an Excel-compatible worksheet export.
   * This produces an .xls file that Microsoft Excel opens as a workbook.
   */
  async generateCourseReportExcel(courseId, lecturerId) {
    try {
      const reportResult = await this.generateCourseReport(courseId, lecturerId);

      if (!reportResult.success) {
        return reportResult;
      }

      const report = reportResult.data;
      const course = report.course;
      const sessionHeaders = report.sessionList
        .map(session => `<th>${this.escapeHTML(session.label)}</th>`)
        .join('');

      const rows = report.data
        .map(student => {
          const attendanceValues = Object.values(student.attendance)
            .map(status => {
              const label = status === 'P' ? 'Present' : 'Absent';
              return `<td>${label}</td>`;
            })
            .join('');

          return `
            <tr>
              <td>${this.escapeHTML(student.studentId)}</td>
              <td>${this.escapeHTML(student.name)}</td>
              <td>${this.escapeHTML(student.email)}</td>
              ${attendanceValues}
            </tr>
          `;
        })
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #999; padding: 8px; text-align: left; }
            th { background: #d9e8ff; font-weight: bold; }
            .title { font-size: 18px; font-weight: bold; }
            .meta { color: #555; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td class="title" colspan="${Math.max(report.sessions + 3, 4)}">
                Attendance Report: ${this.escapeHTML(course.code)} - ${this.escapeHTML(course.name)}
              </td>
            </tr>
            <tr>
              <td class="meta" colspan="${Math.max(report.sessions + 3, 4)}">
                Semester: ${this.escapeHTML(course.semester)} | Students: ${report.students} | Sessions: ${report.sessions}
              </td>
            </tr>
            <tr></tr>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Email</th>
              ${sessionHeaders}
            </tr>
            ${rows}
          </table>
        </body>
        </html>
      `;

      return {
        success: true,
        data: html,
        fileBaseName: `attendance_report_${course.code}_${Date.now()}`
      };
    } catch (error) {
      console.error('Error generating Excel report:', error.message);
      return {
        success: false,
        error: 'Failed to generate Excel report'
      };
    }
  }

  escapeCSVValue(value) {
    const stringValue = String(value ?? '');
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = new ReportService();
