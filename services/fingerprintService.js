const axios = require('axios');
const config = require('../config');
const Fingerprint = require('../models/Fingerprint');
const { getFingerName } = require('../utils/fingerNames');

class FingerprintService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: config.fingerprint.bridgeAPI,
      timeout: Math.max(config.fingerprint.captureTimeoutMs + 10000, 40000)
    });
  }

  get primaryFingerIndex() {
    return 5; // Right Thumb
  }

  get maxFingerprintsPerStudent() {
    return 2;
  }

  normalizeMatchScore(score) {
    const numericScore = Number(score) || 0;

    if (numericScore <= 100) {
      return Math.max(0, Math.min(100, Math.round(numericScore)));
    }

    // Morfin returns match scores on a 0-1000-ish scale. Attendance records
    // store a user-facing confidence percentage, so keep raw scores separate.
    return Math.max(0, Math.min(100, Math.round(numericScore / 10)));
  }

  /**
   * Get information about the fingerprint scanner bridge API
   */
  async getBridgeInfo() {
    try {
      const response = await this.apiClient.get('/info');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      if (config.fingerprint.mockEnabled) {
        return {
          success: true,
          data: {
            name: 'Mock Fingerprint Bridge',
            mode: 'mock',
            message: 'Hardware bridge unavailable; mock mode is enabled'
          }
        };
      }

      console.error('Error getting bridge info:', error.message);
      return {
        success: false,
        error: 'Failed to connect to fingerprint bridge API'
      };
    }
  }

  /**
   * Capture fingerprint from scanner
   * @param {number} fingerIndex - which finger (0-9)
   */
  async captureFingerprint(fingerIndex, options = {}) {
    try {
      if (fingerIndex < 0 || fingerIndex > 9) {
        return {
          success: false,
          error: 'Invalid finger index. Must be between 0 and 9'
        };
      }

      if (options.forceMock) {
        return this.createMockCapture(fingerIndex, options.mockStudentId);
      }

      const captureTimeoutMs = options.timeoutMs || config.fingerprint.captureTimeoutMs;
      const response = await this.apiClient.post(
        '/capture',
        {
          fingerIndex: fingerIndex,
          mockStudentId: options.mockStudentId,
          timeoutMs: captureTimeoutMs,
          quality: options.quality || config.fingerprint.captureQuality
        },
        {
          timeout: captureTimeoutMs + 10000
        }
      );

      if (!response.data.success) {
        return {
          success: false,
          error: response.data.error || 'Fingerprint capture failed'
        };
      }

      return {
        success: true,
        data: {
          templateData: response.data.templateData, // base64 string
          fingerIndex: fingerIndex,
          quality: response.data.quality || null,
          nfiq: response.data.nfiq || null,
          device: response.data.device || null,
          imageData: response.data.imageData || null,
          imageMimeType: response.data.imageMimeType || null
        }
      };
    } catch (error) {
      if (config.fingerprint.mockEnabled) {
        return this.createMockCapture(fingerIndex, options.mockStudentId);
      }

      console.error('Error capturing fingerprint:', error.message);
      return {
        success: false,
        error:
          error.response?.data?.error ||
          (error.code === 'ECONNABORTED'
            ? 'Fingerprint capture timed out. Place your finger flat on the scanner and try again.'
            : 'Failed to capture fingerprint from scanner')
      };
    }
  }

  /**
   * Open a streaming capture response from the local bridge.
   * The stream emits Server-Sent Event data lines with quality/position updates.
   */
  async openCaptureStream(fingerIndex, options = {}) {
    const captureTimeoutMs = options.timeoutMs || config.fingerprint.captureTimeoutMs;

    return this.apiClient.get('/capture-stream', {
      params: {
        fingerIndex,
        mockStudentId: options.mockStudentId,
        timeoutMs: captureTimeoutMs,
        quality: options.quality || config.fingerprint.captureQuality
      },
      responseType: 'stream',
      timeout: 0
    });
  }

  /**
   * Check whether a student already has an active enrollment for a finger.
   */
  async hasActiveFingerprint(studentId, fingerIndex) {
    try {
      const fingerprint = await Fingerprint.findOne({
        student: studentId,
        fingerIndex: Number(fingerIndex),
        isActive: true
      })
        .select('_id fingerIndex')
        .lean();

      return {
        success: true,
        exists: Boolean(fingerprint),
        data: fingerprint
          ? {
              ...fingerprint,
              fingerName: getFingerName(fingerprint.fingerIndex)
            }
          : null
      };
    } catch (error) {
      console.error('Error checking fingerprint:', error.message);
      return {
        success: false,
        error: 'Failed to check existing fingerprint'
      };
    }
  }

  async assertFingerAvailable(studentId, fingerIndex) {
    const result = await this.hasActiveFingerprint(studentId, fingerIndex);

    if (!result.success) {
      return result;
    }

    if (result.exists) {
      return {
        success: false,
        error: `${result.data.fingerName} is already enrolled for this student. Delete it before scanning again.`,
        code: 'FINGER_ALREADY_ENROLLED',
        data: result.data
      };
    }

    const policy = await this.validateEnrollmentPolicy(studentId, fingerIndex);
    if (!policy.success) {
      return policy;
    }

    return {
      success: true
    };
  }

  async validateEnrollmentPolicy(studentId, fingerIndex) {
    const numericFingerIndex = Number(fingerIndex);
    const fingerprints = await Fingerprint.find({
      student: studentId,
      isActive: true
    })
      .select('_id fingerIndex')
      .lean();

    const hasPrimaryFinger = fingerprints.some(
      fingerprint => Number(fingerprint.fingerIndex) === this.primaryFingerIndex
    );

    if (fingerprints.length >= this.maxFingerprintsPerStudent) {
      return {
        success: false,
        code: 'FINGER_LIMIT_REACHED',
        error: 'This student already has a right thumb and one backup finger enrolled. Delete one before adding another.'
      };
    }

    if (!hasPrimaryFinger && numericFingerIndex !== this.primaryFingerIndex) {
      return {
        success: false,
        code: 'PRIMARY_FINGER_REQUIRED',
        error: 'Enroll the Right Thumb first. After that, you can add one backup finger.'
      };
    }

    if (hasPrimaryFinger && numericFingerIndex === this.primaryFingerIndex) {
      return {
        success: false,
        code: 'FINGER_ALREADY_ENROLLED',
        error: 'Right Thumb is already enrolled for this student.'
      };
    }

    return {
      success: true
    };
  }

  /**
   * Match two fingerprint templates
   * @param {string} probeTemplate - captured live template (base64)
   * @param {string} galleryTemplate - stored template (base64)
   */
  async matchFingerprints(probeTemplate, galleryTemplate) {
    try {
      if (
        probeTemplate.startsWith('mock:') &&
        galleryTemplate.startsWith('mock:')
      ) {
        const probeStudentId = probeTemplate.split(':')[1];
        const galleryStudentId = galleryTemplate.split(':')[1];
        const matched = probeStudentId === galleryStudentId;
        return {
          success: true,
          data: {
            score: matched ? 100 : 0,
            confidenceScore: matched ? 100 : 0,
            matched,
            threshold: config.fingerprint.threshold
          }
        };
      }

      const response = await this.apiClient.post(
        '/match',
        {
          probeTemplate: probeTemplate,
          galleryTemplate: galleryTemplate,
          threshold: config.fingerprint.threshold
        },
        {
          timeout: Math.max(config.fingerprint.captureTimeoutMs + 10000, 40000)
        }
      );

      if (!response.data.success) {
        return {
          success: false,
          error: response.data.error || 'Fingerprint matching failed'
        };
      }

      return {
        success: true,
        data: {
          score: response.data.score || 0,
          confidenceScore: this.normalizeMatchScore(response.data.score || 0),
          matched: response.data.score >= config.fingerprint.threshold,
          threshold: config.fingerprint.threshold
        }
      };
    } catch (error) {
      console.error('Error matching fingerprints:', error.message);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to match fingerprints'
      };
    }
  }

  /**
   * Enroll a student's fingerprint
   * @param {ObjectId} studentId - student ObjectId
   * @param {number} fingerIndex - which finger
   * @param {string} templateData - base64 template from bridge API
   */
  async enrollFingerprint(studentId, fingerIndex, templateData) {
    try {
      const numericFingerIndex = Number(fingerIndex);

      // Check if fingerprint already exists
      const existing = await Fingerprint.findOne({
        student: studentId,
        fingerIndex: numericFingerIndex,
        isActive: true
      });

      if (existing) {
        return {
          success: false,
          error: `${getFingerName(existing.fingerIndex)} is already enrolled for this student. Delete it before scanning again.`,
          code: 'FINGER_ALREADY_ENROLLED'
        };
      }

      const policy = await this.validateEnrollmentPolicy(studentId, numericFingerIndex);
      if (!policy.success) {
        return policy;
      }

      const existingFingerprints = await Fingerprint.find({
        student: studentId,
        isActive: true
      }).lean();

      for (const fingerprint of existingFingerprints) {
        const matchResult = await this.matchFingerprints(
          templateData,
          fingerprint.templateData
        );

        if (matchResult.success && matchResult.data.matched) {
          return {
            success: false,
            code: 'DUPLICATE_FINGERPRINT_TEMPLATE',
            error: `This scan matches the already enrolled ${getFingerName(fingerprint.fingerIndex)}. Use the selected finger, not the same finger again.`,
            data: {
              existingFingerIndex: fingerprint.fingerIndex,
              existingFingerName: getFingerName(fingerprint.fingerIndex),
              selectedFingerIndex: numericFingerIndex,
              selectedFingerName: getFingerName(numericFingerIndex),
              score: matchResult.data.score,
              confidenceScore: matchResult.data.confidenceScore
            }
          };
        }
      }

      await Fingerprint.deleteMany({
        student: studentId,
        fingerIndex: numericFingerIndex,
        isActive: false
      });

      const fingerprint = new Fingerprint({
        student: studentId,
        fingerIndex: numericFingerIndex,
        templateData: templateData,
        isActive: true
      });
      await fingerprint.save();

      return {
        success: true,
        data: fingerprint
      };
    } catch (error) {
      console.error('Error enrolling fingerprint:', error.message);
      return {
        success: false,
        error: 'Failed to enroll fingerprint'
      };
    }
  }

  /**
   * Get all fingerprints for a student
   * @param {ObjectId} studentId
   */
  async getStudentFingerprints(studentId) {
    try {
      const fingerprints = await Fingerprint.find({
        student: studentId,
        isActive: true
      }).lean();

      return {
        success: true,
        data: fingerprints.map(fingerprint => ({
          ...fingerprint,
          fingerName: getFingerName(fingerprint.fingerIndex)
        }))
      };
    } catch (error) {
      console.error('Error fetching fingerprints:', error.message);
      return {
        success: false,
        error: 'Failed to fetch fingerprints'
      };
    }
  }

  /**
   * Delete a fingerprint
   * @param {ObjectId} fingerprintId
   */
  async deleteFingerprint(fingerprintId) {
    try {
      const fingerprint = await Fingerprint.findByIdAndDelete(fingerprintId);

      if (!fingerprint) {
        return {
          success: false,
          error: 'Fingerprint not found'
        };
      }

      return {
        success: true,
        data: fingerprint
      };
    } catch (error) {
      console.error('Error deleting fingerprint:', error.message);
      return {
        success: false,
        error: 'Failed to delete fingerprint'
      };
    }
  }

  /**
   * Match captured fingerprint against all enrolled fingerprints for students in a course
   * @param {string} liveTemplate - captured template (base64)
   * @param {ObjectId} courseId - course to search within
   */
  async findMatchInCourse(liveTemplate, courseId) {
    try {
      const Enrollment = require('../models/Enrollment');
      
      // Get all students enrolled in course
      const enrollments = await Enrollment.find({
        course: courseId,
        status: 'active'
      }).populate('student');

      // Get all fingerprints for these students
      const studentIds = enrollments.map(e => e.student._id);
      const fingerprints = await Fingerprint.find({
        student: { $in: studentIds },
        isActive: true
      }).populate('student');

      let bestMatch = null;
      let bestScore = 0;
      let bestCandidate = null;
      let checkedCount = 0;
      const matchErrors = [];

      // Try to match against each fingerprint
      for (const fingerprint of fingerprints) {
        const matchResult = await this.matchFingerprints(
          liveTemplate,
          fingerprint.templateData
        );

        if (!matchResult.success) {
          matchErrors.push(matchResult.error);
          continue;
        }

        checkedCount++;

        if (matchResult.data.score > bestScore) {
          bestScore = matchResult.data.score;
          bestCandidate = {
            student: fingerprint.student,
            fingerprint,
            score: matchResult.data.score,
            confidenceScore: matchResult.data.confidenceScore
          };
        }

        if (matchResult.data.matched) {
          if (!bestMatch || matchResult.data.score > bestMatch.score) {
            bestMatch = {
              student: fingerprint.student,
              fingerprint: fingerprint,
              score: matchResult.data.score,
              confidenceScore: matchResult.data.confidenceScore
            };
          }
        }
      }

      if (bestMatch) {
        return {
          success: true,
          found: true,
          data: bestMatch
        };
      } else if (checkedCount === 0 && matchErrors.length > 0) {
        return {
          success: false,
          error: matchErrors[0] || 'Fingerprint matching failed'
        };
      } else {
        return {
          success: true,
          found: false,
          data: {
            checkedCount,
            enrolledFingerprintCount: fingerprints.length,
            bestScore,
            bestConfidenceScore: this.normalizeMatchScore(bestScore),
            closest: bestCandidate
              ? {
                  student: bestCandidate.student,
                  fingerIndex: bestCandidate.fingerprint.fingerIndex,
                  fingerName: getFingerName(bestCandidate.fingerprint.fingerIndex),
                  score: bestCandidate.score,
                  confidenceScore: bestCandidate.confidenceScore
                }
              : null,
            threshold: config.fingerprint.threshold,
            message:
              fingerprints.length === 0
                ? 'No enrolled fingerprints were found for students in this course'
                : 'No enrolled fingerprint matched this scan'
          }
        };
      }
    } catch (error) {
      console.error('Error finding match in course:', error.message);
      return {
        success: false,
        error: 'Failed to find fingerprint match'
      };
    }
  }

  /**
   * Match captured fingerprint only against one enrolled student in a course.
   * This is the preferred attendance flow because the lecturer chooses the
   * student first, then the scanner verifies that student's enrolled finger.
   */
  async matchStudentInCourse(liveTemplate, courseId, studentId) {
    try {
      const Enrollment = require('../models/Enrollment');

      const enrollment = await Enrollment.findOne({
        course: courseId,
        student: studentId,
        status: 'active'
      }).populate('student');

      if (!enrollment || !enrollment.student) {
        return {
          success: false,
          error: 'Selected student is not enrolled in this course'
        };
      }

      const fingerprints = await Fingerprint.find({
        student: studentId,
        isActive: true
      }).populate('student');

      if (fingerprints.length === 0) {
        return {
          success: true,
          found: false,
          data: {
            checkedCount: 0,
            enrolledFingerprintCount: 0,
            bestScore: 0,
            bestConfidenceScore: 0,
            selectedStudent: enrollment.student,
            threshold: config.fingerprint.threshold,
            message: 'No fingerprint is enrolled for the selected student'
          }
        };
      }

      let bestMatch = null;
      let bestScore = 0;
      let bestCandidate = null;
      const matchErrors = [];
      let checkedCount = 0;

      for (const fingerprint of fingerprints) {
        const matchResult = await this.matchFingerprints(
          liveTemplate,
          fingerprint.templateData
        );

        if (!matchResult.success) {
          matchErrors.push(matchResult.error);
          continue;
        }

        checkedCount++;

        if (matchResult.data.score > bestScore) {
          bestScore = matchResult.data.score;
          bestCandidate = {
            fingerprint,
            score: matchResult.data.score,
            confidenceScore: matchResult.data.confidenceScore
          };
        }

        if (matchResult.data.matched) {
          if (!bestMatch || matchResult.data.score > bestMatch.score) {
            bestMatch = {
              student: enrollment.student,
              fingerprint,
              score: matchResult.data.score,
              confidenceScore: matchResult.data.confidenceScore
            };
          }
        }
      }

      if (bestMatch) {
        return {
          success: true,
          found: true,
          data: bestMatch
        };
      }

      if (checkedCount === 0 && matchErrors.length > 0) {
        return {
          success: false,
          error: matchErrors[0] || 'Fingerprint matching failed'
        };
      }

      return {
        success: true,
        found: false,
        data: {
          checkedCount,
          enrolledFingerprintCount: fingerprints.length,
          bestScore,
          bestConfidenceScore: this.normalizeMatchScore(bestScore),
          selectedStudent: enrollment.student,
          closest: bestCandidate
            ? {
                student: enrollment.student,
                fingerIndex: bestCandidate.fingerprint.fingerIndex,
                fingerName: getFingerName(bestCandidate.fingerprint.fingerIndex),
                score: bestCandidate.score,
                confidenceScore: bestCandidate.confidenceScore
              }
            : null,
          threshold: config.fingerprint.threshold,
          message: 'The scan did not match the selected student'
        }
      };
    } catch (error) {
      console.error('Error matching selected student:', error.message);
      return {
        success: false,
        error: 'Failed to match selected student fingerprint'
      };
    }
  }

  createMockCapture(fingerIndex, mockStudentId = null) {
    if (!mockStudentId) {
      return {
        success: false,
        error: 'Mock fingerprint capture requires a student selection'
      };
    }

    return {
      success: true,
      data: {
        templateData: `mock:${mockStudentId}:${fingerIndex}`,
        fingerIndex,
        quality: 100
      }
    };
  }
}

module.exports = new FingerprintService();
