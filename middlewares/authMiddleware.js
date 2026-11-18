/**
 * Authentication middleware
 * Verifies user is logged in (session-based)
 */
const authMiddleware = (req, res, next) => {
  if (req.session && req.session.lecturerId) {
    // User is authenticated
    next();
  } else {
    res.redirect('/auth/login');
  }
};

/**
 * API Authentication middleware
 * For JSON requests: returns JSON error
 */
const apiAuthMiddleware = (req, res, next) => {
  if (req.session && req.session.lecturerId) {
    next();
  } else {
    res.status(401).json({
      success: false,
      error: 'Unauthorized - please login'
    });
  }
};

/**
 * Make lecturer ID available in requests
 */
const attachLecturerMiddleware = (req, res, next) => {
  if (req.session && req.session.lecturerId) {
    req.lecturerId = req.session.lecturerId;
  }
  next();
};

module.exports = {
  authMiddleware,
  apiAuthMiddleware,
  attachLecturerMiddleware
};
