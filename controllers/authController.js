const Lecturer = require('../models/Lecturer');
const Student = require('../models/Student');
const Course = require('../models/Course');

/**
 * Show login page
 */
exports.showLogin = (req, res) => {
  if (req.session && req.session.lecturerId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login');
};

/**
 * Show register page
 */
exports.showRegister = (req, res) => {
  if (req.session && req.session.lecturerId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/register');
};

/**
 * Register lecturer
 */
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    // Validate input
    if (!fullName || !email || !password || !confirmPassword) {
      return res.render('auth/register', {
        error: 'All fields are required'
      });
    }

    if (password !== confirmPassword) {
      return res.render('auth/register', {
        error: 'Passwords do not match'
      });
    }

    if (password.length < 6) {
      return res.render('auth/register', {
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if email already exists
    const existing = await Lecturer.findOne({ email });
    if (existing) {
      return res.render('auth/register', {
        error: 'Email already registered'
      });
    }

    // Create lecturer
    const lecturer = new Lecturer({
      fullName,
      email,
      password
    });

    await lecturer.save();

    res.redirect('/auth/login?message=Registration successful. Please login.');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', {
      error: 'Registration failed. Please try again.'
    });
  }
};

/**
 * Login lecturer
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.render('auth/login', {
        error: 'Email and password are required'
      });
    }

    // Find lecturer by email
    const lecturer = await Lecturer.findOne({ email }).select('+password');

    if (!lecturer) {
      return res.render('auth/login', {
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await lecturer.comparePassword(password);

    if (!isPasswordValid) {
      return res.render('auth/login', {
        error: 'Invalid email or password'
      });
    }

    // Update last login
    lecturer.lastLogin = new Date();
    await lecturer.save();

    // Create session
    req.session.lecturerId = lecturer._id.toString();
    req.session.lecturerEmail = lecturer.email;
    req.session.lecturerName = lecturer.fullName;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', {
      error: 'Login failed. Please try again.'
    });
  }
};

/**
 * Logout lecturer
 */
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/auth/login');
  });
};

/**
 * Show dashboard
 */
exports.showDashboard = async (req, res) => {
  try {
    const [totalStudents, totalCourses] = await Promise.all([
      Student.countDocuments({ isActive: true }),
      Course.countDocuments({ lecturer: req.lecturerId, isActive: true })
    ]);

    res.render('dashboard', {
      lecturerName: req.session.lecturerName,
      totalStudents,
      totalCourses
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('dashboard', {
      lecturerName: req.session.lecturerName,
      totalStudents: 0,
      totalCourses: 0,
      error: 'Failed to load dashboard stats'
    });
  }
};
