# Fingerprint Attendance System

A production-ready biometric attendance platform built with Node.js, Express.js, EJS, and MongoDB. Lecturers can register, create courses, enroll students, and mark attendance using fingerprint recognition.

## 🎯 Features

### Authentication & Security
- ✅ Lecturer registration and login
- ✅ Session-based authentication with express-session
- ✅ Password hashing with bcrypt
- ✅ Secure session storage in MongoDB
- ✅ Protected routes and API endpoints

### Student Management
- ✅ Create and manage students
- ✅ Import students from CSV
- ✅ View student details and enrollment history
- ✅ Track fingerprint enrollment status

### Course Management
- ✅ Create courses with code, name, description
- ✅ Enroll students in courses
- ✅ View course details and enrolled students
- ✅ Manage course enrollments

### Fingerprint System (Biometric)
- ✅ Integrate with external fingerprint scanner bridge API
- ✅ Capture fingerprints from scanner
- ✅ Store fingerprint templates securely
- ✅ Match fingerprints for attendance
- ✅ Prevent duplicate fingerprints per student

### Attendance Management
- ✅ Create attendance sessions
- ✅ Manual attendance marking
- ✅ Biometric fingerprint-based attendance
- ✅ Override attendance records
- ✅ Close sessions

### Reporting & Analytics
- ✅ Generate attendance reports
- ✅ Export reports to CSV
- ✅ Course statistics
- ✅ Student attendance statistics

## 🏗️ Architecture

```
fingerprint-attendance/
├── config/              # Configuration files
│   ├── index.js        # Main config
│   └── database.js     # MongoDB connection
├── controllers/         # Business logic controllers
├── models/             # Mongoose schemas
├── services/           # Service layer (business logic)
├── routes/             # API routes
├── middlewares/        # Custom middleware
├── views/              # EJS templates
├── public/             # Static files (CSS, JS)
│   ├── css/
│   └── js/
├── utils/              # Utility functions
├── server.js           # Main entry point
└── package.json        # Dependencies
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (LTS)
- MongoDB 4.4+
- npm 9+

### Installation

1. **Clone and navigate to project:**
```bash
cd fingerprint-attendance
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/fingerprint-attendance
SESSION_SECRET=your_random_secret_key_here
FINGERPRINT_BRIDGE_API=http://localhost:5000
BCRYPT_ROUNDS=10
```

4. **Start MongoDB:**
```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Windows (ensure MongoDB is installed)
net start MongoDB

# Or run MongoDB in Docker
docker run -d -p 27017:27017 --name mongodb mongo
```

5. **Run the application:**

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

6. **Access the application:**
Open http://localhost:3000 in your browser

## 📖 Usage Guide

### 1. Register as a Lecturer
- Navigate to /auth/register
- Enter full name, email, and password
- Click Register

### 2. Login
- Navigate to /auth/login
- Enter email and password
- Access dashboard

### 3. Create a Course
- Go to "Courses" menu
- Click "Create Course"
- Fill in course details (code, name, semester)
- Save

### 4. Add Students
- Go to "Students" menu
- Option 1: Click "Add Student" for individual entry
- Option 2: Click "Import from CSV" for bulk upload

#### CSV Format for Import:
```csv
studentId,firstName,lastName,email,phone
STU001,John,Doe,john@example.com,555-0001
STU002,Jane,Smith,jane@example.com,555-0002
```

### 5. Enroll Students in Course
- Go to course details
- Click "Manage Students"
- Select student from dropdown
- Click "Enroll Student"

### 6. Enroll Fingerprints
- Go to "Fingerprints" menu
- Select student
- Select which finger to scan
- Click "Capture Fingerprint"
- Place finger on scanner when prompted
- Template will be stored

### 7. Create Attendance Session
- Go to course "Attendance Sessions"
- Click "New Session"
- Enter date, start time, end time, topic
- Save

### 8. Mark Attendance
- Go to attendance session
- Option 1: Manual - Click student name to mark Present/Absent
- Option 2: Biometric - Click "Scan Fingerprint" button
  - Student's fingerprint will be matched automatically
- You can override any marking
- Click "Close Session" when done

### 9. Generate Reports
- Go to course
- Click "Attendance Report"
- View attendance matrix
- Export as CSV for further analysis

## 🔌 API Endpoints

### Authentication
- `GET /auth/login` - Show login page
- `POST /auth/login` - Process login
- `GET /auth/register` - Show register page
- `POST /auth/register` - Create lecturer account
- `GET /auth/logout` - Logout

### Students
- `GET /students` - List all students
- `POST /students` - Create student
- `GET /students/detail/:id` - View student details
- `PUT /students/:id` - Update student
- `DELETE /students/:id` - Delete student
- `POST /students/import` - Import from CSV

### Courses
- `GET /courses` - List lecturer's courses
- `POST /courses` - Create course
- `GET /courses/:id` - View course details
- `PUT /courses/:id` - Update course
- `DELETE /courses/:id` - Delete course

### Enrollments
- `POST /enrollments/enroll` - Enroll student in course
- `POST /enrollments/unenroll` - Remove from course
- `GET /enrollments/course/:courseId` - List course enrollments
- `GET /enrollments/student/:studentId` - List student courses

### Fingerprints (Biometric)
- `GET /fingerprint/enroll` - Fingerprint enrollment page
- `GET /fingerprint/api/bridge-info` - Get bridge API info
- `POST /fingerprint/api/capture` - Capture fingerprint
- `POST /fingerprint/api/enroll` - Enroll fingerprint
- `GET /fingerprint/api/student/:studentId/fingerprints` - Get student fingerprints
- `DELETE /fingerprint/api/fingerprint/:fingerprintId` - Delete fingerprint
- `POST /fingerprint/api/capture-for-attendance` - Capture and match for attendance

### Attendance
- `GET /attendance/course/:courseId/sessions` - List sessions
- `POST /attendance/course/:courseId/sessions` - Create session
- `GET /attendance/session/:sessionId/mark` - Mark attendance page
- `POST /attendance/session/:sessionId/mark` - Mark attendance
- `POST /attendance/override` - Override attendance
- `POST /attendance/session/:sessionId/close` - Close session

### Reports
- `GET /reports/course/:courseId` - View attendance report
- `GET /reports/course/:courseId/export-csv` - Export as CSV
- `GET /reports/course/:courseId/statistics` - Course statistics

## 🔐 Authentication & Security

All routes except `/auth/login` and `/auth/register` require authentication.

### Session Management
- Sessions stored in MongoDB
- Session cookie expires in 24 hours
- Secure HTTP-only cookies (HTTPS in production)
- CSRF protection via session tokens

### Password Security
- Passwords hashed with bcrypt (10 rounds)
- Never stored in plain text
- Password verified during login

### Data Validation
- All inputs validated using express-validator
- MongoDB schema validation
- Duplicate prevention (student ID, course code, email)
- Type checking on all API endpoints

## 📊 Database Models

### Lecturer
```javascript
{
  fullName: String,
  email: String (unique),
  password: String (hashed),
  isAdmin: Boolean,
  lastLogin: Date,
  isActive: Boolean
}
```

### Student
```javascript
{
  studentId: String (unique),
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  fingerprintEnrolled: Boolean,
  isActive: Boolean
}
```

### Course
```javascript
{
  code: String (unique),
  name: String,
  description: String,
  lecturer: ObjectId (ref: Lecturer),
  semester: Number,
  maxStudents: Number,
  isActive: Boolean
}
```

### Enrollment
```javascript
{
  student: ObjectId (ref: Student),
  course: ObjectId (ref: Course),
  enrollmentDate: Date,
  status: String (active/dropped/completed)
}
```

### Fingerprint
```javascript
{
  student: ObjectId (ref: Student),
  fingerIndex: Number (0-9),
  templateData: String (base64),
  isActive: Boolean
}
```

### AttendanceSession
```javascript
{
  course: ObjectId (ref: Course),
  sessionDate: Date,
  startTime: String (HH:MM),
  endTime: String (HH:MM),
  status: String (open/closed),
  topic: String
}
```

### AttendanceRecord
```javascript
{
  session: ObjectId (ref: AttendanceSession),
  student: ObjectId (ref: Student),
  status: String (present/absent),
  confidenceScore: Number (0-100),
  fingerUsed: Boolean,
  markedBy: String (manual/biometric)
}
```

## 🔌 Fingerprint Bridge API Integration

The system integrates with an external fingerprint scanner bridge API.

### Expected Bridge API Endpoints:

```
GET /info
Response: { success: boolean, version: string, ... }

POST /capture
Request: { fingerIndex: number }
Response: { success: boolean, templateData: string (base64), quality: number }

POST /match
Request: {
  probeTemplate: string (base64),
  galleryTemplate: string (base64),
  threshold: number
}
Response: { success: boolean, score: number (0-100), matched: boolean }
```

### Configuration
Set `FINGERPRINT_BRIDGE_API` in `.env` to your bridge API URL:
```env
FINGERPRINT_BRIDGE_API=http://your-fingerprint-api.local:5000
```

## 🛠️ Development

### Project Structure Details

**Controllers**
- Receive HTTP requests
- Call services for business logic
- Return responses
- No business logic in controllers

**Services**
- Contain all business logic
- Interact with models/database
- Handle errors
- Return consistent response format

**Models**
- Define database schemas
- Validate data
- Include virtual fields
- Handle password hashing (Lecturer model)

**Middleware**
- Authentication (session-based)
- Error handling (global)
- Request logging (can be added)

**Routes**
- Define endpoints
- Apply middleware
- Map to controllers

**Views**
- EJS templates
- Bootstrap for styling
- Vanilla JavaScript (no frontend framework)
- Fetch API for AJAX calls

### Adding New Features

1. Create model in `/models`
2. Create service in `/services`
3. Create controller in `/controllers`
4. Create routes in `/routes`
5. Create views in `/views` (if needed)
6. Register routes in `server.js`

## 📝 Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/fingerprint-attendance

# Session
SESSION_SECRET=your_super_secret_key_change_in_production

# Fingerprint Bridge API
FINGERPRINT_BRIDGE_API=http://localhost:5000

# Security
BCRYPT_ROUNDS=10
```

## 🐛 Troubleshooting

### MongoDB Connection Fails
- Ensure MongoDB is running: `mongod`
- Check `MONGODB_URI` in `.env`
- Verify connection string format

### Fingerprint Capture Fails
- Ensure fingerprint bridge API is running
- Check `FINGERPRINT_BRIDGE_API` in `.env`
- Verify bridge API is responding: `curl http://localhost:5000/info`

### Session Issues
- Clear browser cookies
- Restart server
- Check MongoDB is storing sessions

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :3000   # Windows
```

## 📚 Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB, Mongoose
- **Authentication**: express-session
- **Hashing**: bcrypt
- **API Calls**: axios
- **CSV Parsing**: csv-parser
- **Security**: helmet, cors
- **Templates**: EJS
- **Frontend**: Bootstrap, Vanilla JavaScript
- **Styling**: CSS3

## 🔄 API Response Format

All API endpoints return JSON:

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

## 📄 License

ISC License

## 🤝 Contributing

This is a complete production-ready system. For enhancements:

1. Follow existing code patterns
2. Add business logic to services
3. Keep controllers thin
4. Maintain separation of concerns
5. Update documentation

## 📞 Support

For issues or questions:
1. Check troubleshooting section
2. Review server logs
3. Verify environment configuration
4. Check MongoDB connection

---

**Built with ❤️ for Production**
