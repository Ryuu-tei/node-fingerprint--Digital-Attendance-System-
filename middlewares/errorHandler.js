/**
 * Global error handling middleware
 * Should be registered last in Express app
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Check if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  // Cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }

  // Duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      error: `${field} already exists`
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // For JSON requests
  if (req.accepts('json')) {
    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }

  // For HTML requests
  res.status(statusCode).render('error', {
    message,
    statusCode
  });
};

/**
 * Async error wrapper for controllers
 * Catches promise rejections
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  asyncHandler
};
