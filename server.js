/**
 * Fingerprint Attendance System - Main Server
 * Production-ready Node.js + Express application
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
// const mongoSession = require('connect-mongo');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();

// Database and config
const { connectDB } = require('./config/database');
const config = require('./config');

// Middleware imports
const { errorHandler, asyncHandler } = require('./middlewares/errorHandler');
const { authMiddleware, attachLecturerMiddleware } = require('./middlewares/authMiddleware');

// Routes imports
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const courseRoutes = require('./routes/courseRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const fingerprintRoutes = require('./routes/fingerprintRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const authController = require('./controllers/authController');

// Security middleware
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
                connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
                fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'data:'],
                imgSrc: ["'self'", 'data:']
            }
        }
    })
);
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Lightweight layout support for the existing EJS page fragments.
app.use((req, res, next) => {
    const originalRender = res.render.bind(res);

    res.render = (view, options = {}, callback) => {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        if (view === 'layout' || view.startsWith('partials/')) {
            return originalRender(view, options, callback);
        }

        const locals = {
            ...options,
            lecturerName: options.lecturerName || req.session?.lecturerName,
            message: options.message || req.query.message,
            currentPath: req.path
        };

        req.app.render(view, locals, (viewErr, body) => {
            if (viewErr) {
                if (callback) {
                    return callback(viewErr);
                }
                return next(viewErr);
            }

            return originalRender('layout', { ...locals, body }, callback);
        });
    };

    next();
});

// Session middleware
app.use(
    session({
        store: MongoStore.create({
            mongoUrl: config.mongodb.uri,
            collectionName: 'sessions',
            touchAfter: 24 * 3600
        }),
        secret: config.session.secret,
        resave: config.session.resave,
        saveUninitialized: config.session.saveUninitialized,
        cookie: config.session.cookie
    })
);

// Attach lecturer info to requests
app.use(attachLecturerMiddleware);

// Routes
app.get('/', (req, res) => {
    if (req.session && req.session.lecturerId) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/auth/login');
    }
});

// Public auth routes (NO auth required)
app.use('/auth', authRoutes);

// Protected routes (auth required)
app.get('/dashboard', authMiddleware, authController.showDashboard);

app.use('/students', authMiddleware, studentRoutes);
app.use('/courses', authMiddleware, courseRoutes);
app.use('/enrollments', authMiddleware, enrollmentRoutes);
app.use('/fingerprint', authMiddleware, fingerprintRoutes);
app.use('/attendance', authMiddleware, attendanceRoutes);
app.use('/reports', authMiddleware, reportRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        message: 'Page not found (404)'
    });
});

// Global error handler (must be last)
app.use(errorHandler);

/**
 * Start Server
 */
async function startServer() {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start listening
        const PORT = config.port;
        app.listen(PORT, () => {
            console.log(`
============================================================
 Fingerprint Attendance System
 Server:       http://localhost:${PORT}
 Node:         ${process.version}
 Environment:  ${config.nodeEnv}
============================================================
      `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
