const reportService = require('../services/reportService');

/**
 * Show course attendance report
 */
exports.showCourseReport = async (req, res) => {
  try {
    const result = await reportService.generateCourseReport(
      req.params.courseId,
      req.lecturerId
    );

    if (!result.success) {
      return res.status(400).render('error', {
        message: result.error
      });
    }

    res.render('reports/course-report', {
      report: result.data
    });
  } catch (error) {
    console.error('Error showing report:', error);
    res.render('error', {
      message: 'Failed to load report'
    });
  }
};

/**
 * Export course report as CSV (API)
 */
exports.exportCourseReportCSV = async (req, res) => {
  try {
    const result = await reportService.generateCourseReportCSV(
      req.params.courseId,
      req.lecturerId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Set CSV headers
    const fileName = `attendance_report_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    res.send(result.data);
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export report'
    });
  }
};

/**
 * Export course report as Excel-compatible XLS (API)
 */
exports.exportCourseReportExcel = async (req, res) => {
  try {
    const result = await reportService.generateCourseReportExcel(
      req.params.courseId,
      req.lecturerId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    const fileName = `${result.fileBaseName || `attendance_report_${Date.now()}`}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    res.send(result.data);
  } catch (error) {
    console.error('Error exporting Excel report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export Excel report'
    });
  }
};

/**
 * Get course statistics (API)
 */
exports.getCourseStatistics = async (req, res) => {
  try {
    const result = await reportService.getCourseStatistics(
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
      data: result.data
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};

/**
 * Get student statistics for course (API)
 */
exports.getStudentStatistics = async (req, res) => {
  try {
    const result = await reportService.getStudentStatistics(
      req.params.studentId,
      req.params.courseId
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
    console.error('Error fetching student statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};
