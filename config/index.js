require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/fingerprint-attendance'
  },
  session: {
    secret: process.env.SESSION_SECRET || 'change_this_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },
  fingerprint: {
    bridgeAPI: process.env.FINGERPRINT_BRIDGE_API || 'http://localhost:5000',
    threshold: parseInt(process.env.FINGERPRINT_MATCH_THRESHOLD || '60', 10),
    captureTimeoutMs: parseInt(process.env.FINGERPRINT_CAPTURE_TIMEOUT_MS || '30000', 10),
    captureQuality: parseInt(process.env.FINGERPRINT_CAPTURE_QUALITY || '75', 10),
    mockEnabled: process.env.FINGERPRINT_MOCK_ENABLED === 'true'
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS || '10')
  }
};
