require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const { execFile, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json({ limit: '10mb' }));

const PORT = process.env.MANTRA_BRIDGE_PORT || 5000;
const PROVIDER = process.env.MANTRA_BRIDGE_PROVIDER || 'mock';
const CAPTURE_COMMAND = process.env.MANTRA_CAPTURE_COMMAND;
const MATCH_COMMAND = process.env.MANTRA_MATCH_COMMAND;
const MORFIN_COMMAND =
  process.env.MORFIN_BRIDGE_COMMAND ||
  path.join(__dirname, '..', 'morfin', 'sample', 'Output', 'MorfinBridgeCli.exe');
const isCommandModeReady = () =>
  PROVIDER === 'command' && Boolean(CAPTURE_COMMAND && MATCH_COMMAND);
const isMorfinModeReady = () =>
  PROVIDER === 'morfin' && Boolean(MORFIN_COMMAND) && fs.existsSync(MORFIN_COMMAND);

const DEFAULT_CAPTURE_TIMEOUT_MS = Number(process.env.FINGERPRINT_CAPTURE_TIMEOUT_MS || 30000);
const DEFAULT_CAPTURE_QUALITY = Number(process.env.FINGERPRINT_CAPTURE_QUALITY || 75);

const normalizeInt = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
};

const runCommand = (command, args = [], timeout = 30000) => {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { windowsHide: true, timeout, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }

      resolve(stdout.trim());
      }
    );
  });
};

const parseJSONOutput = (output) => {
  try {
    return JSON.parse(output);
  } catch (error) {
    return {
      success: false,
      error: 'Fingerprint command did not return JSON',
      raw: output
    };
  }
};

const createMockTemplate = (fingerIndex, subjectId = 'demo') => {
  const hash = crypto
    .createHash('sha256')
    .update(`${subjectId}:${fingerIndex}`)
    .digest('base64');

  return `mock:${subjectId}:${fingerIndex}:${hash}`;
};

const captureWithMock = (fingerIndex, subjectId) => ({
  success: true,
  templateData: createMockTemplate(fingerIndex, subjectId),
  quality: 96,
  device: 'Mantra MELO31 demo bridge'
});

const sendSse = (res, payload) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const matchMockTemplates = (probeTemplate, galleryTemplate) => {
  const probeParts = String(probeTemplate).split(':');
  const galleryParts = String(galleryTemplate).split(':');
  const matched =
    probeParts[0] === 'mock' &&
    galleryParts[0] === 'mock' &&
    probeParts[1] === galleryParts[1];

  return {
    success: true,
    score: matched ? 100 : 0
  };
};

app.get('/info', (req, res) => {
  const baseInfo = {
    success: true,
    name: 'Mantra MELO31 Bridge',
    provider: PROVIDER,
    ready: PROVIDER === 'mock' || isCommandModeReady() || isMorfinModeReady(),
    captureCommandConfigured: Boolean(CAPTURE_COMMAND),
    matchCommandConfigured: Boolean(MATCH_COMMAND),
    morfinCommand: MORFIN_COMMAND,
    message: isMorfinModeReady()
      ? 'Ready to call the Morfin Authentication SDK adapter'
      : isCommandModeReady()
        ? 'Ready to call configured Mantra SDK wrapper commands'
        : PROVIDER === 'mock'
          ? 'Running in demo mode'
          : 'Real hardware mode needs MANTRA_BRIDGE_PROVIDER=morfin or command mode commands'
  };

  if (PROVIDER !== 'morfin') {
    return res.json(baseInfo);
  }

  runCommand(MORFIN_COMMAND, ['info'])
    .then((output) => {
      const sdk = parseJSONOutput(output);
      const sdkReady = Boolean(sdk.success && sdk.connected);

      res.json({
        ...baseInfo,
        ready: sdkReady,
        message: sdkReady
          ? 'Morfin SDK is ready and a fingerprint device is connected'
          : sdk.error || 'Morfin SDK is available but no fingerprint device is connected',
        sdk
      });
    })
    .catch((error) => {
      res.json({
        ...baseInfo,
        ready: false,
        sdk: {
          success: false,
          error: error.stderr || error.message || 'Morfin adapter info command failed'
        }
      });
    });
});

app.post('/capture', async (req, res) => {
  const fingerIndex = Number(req.body.fingerIndex);
  const subjectId = req.body.mockStudentId || req.body.subjectId || 'demo';
  const captureTimeoutMs = normalizeInt(
    req.body.timeoutMs,
    DEFAULT_CAPTURE_TIMEOUT_MS,
    5000,
    120000
  );
  const captureQuality = normalizeInt(req.body.quality, DEFAULT_CAPTURE_QUALITY, 1, 100);

  if (!Number.isInteger(fingerIndex) || fingerIndex < 0 || fingerIndex > 9) {
    return res.status(400).json({
      success: false,
      error: 'fingerIndex must be an integer from 0 to 9'
    });
  }

  if (PROVIDER === 'mock') {
    return res.json(captureWithMock(fingerIndex, subjectId));
  }

  if (PROVIDER === 'morfin') {
    try {
      const output = await runCommand(
        MORFIN_COMMAND,
        ['capture', String(fingerIndex), String(captureTimeoutMs), String(captureQuality)],
        captureTimeoutMs + 10000
      );
      return res.json(parseJSONOutput(output));
    } catch (error) {
      const commandResult = error.stdout ? parseJSONOutput(error.stdout.trim()) : null;
      if (commandResult && commandResult.success === false) {
        return res.status(500).json(commandResult);
      }

      return res.status(500).json({
        success: false,
        error:
          error.stderr ||
          (error.killed
            ? 'Morfin fingerprint capture timed out before a valid finger was captured'
            : error.message) ||
          'Morfin fingerprint capture failed'
      });
    }
  }

  if (PROVIDER !== 'command' || !CAPTURE_COMMAND) {
    return res.status(500).json({
      success: false,
      error:
        'Mantra capture provider is not configured. Set MANTRA_CAPTURE_COMMAND to a Morfin/MELO31 SDK wrapper executable.'
    });
  }

  try {
    const output = await runCommand(
      CAPTURE_COMMAND,
      [String(fingerIndex), String(captureTimeoutMs), String(captureQuality)],
      captureTimeoutMs + 10000
    );
    res.json(parseJSONOutput(output));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.stderr || error.message || 'Fingerprint capture command failed'
    });
  }
});

app.get('/capture-stream', (req, res) => {
  const fingerIndex = Number(req.query.fingerIndex);
  const subjectId = req.query.mockStudentId || req.query.subjectId || 'demo';
  const captureTimeoutMs = normalizeInt(
    req.query.timeoutMs,
    DEFAULT_CAPTURE_TIMEOUT_MS,
    5000,
    120000
  );
  const captureQuality = normalizeInt(req.query.quality, DEFAULT_CAPTURE_QUALITY, 1, 100);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!Number.isInteger(fingerIndex) || fingerIndex < 0 || fingerIndex > 9) {
    sendSse(res, {
      event: 'done',
      success: false,
      error: 'fingerIndex must be an integer from 0 to 9'
    });
    return res.end();
  }

  if (PROVIDER === 'mock') {
    sendSse(res, {
      event: 'started',
      device: 'Mantra MELO31 demo bridge',
      requiredQuality: captureQuality,
      timeoutMs: captureTimeoutMs,
      message: 'Place your finger flat in the center of the scanner.'
    });
    setTimeout(() => {
      sendSse(res, {
        event: 'preview',
        quality: 96,
        fingerPosition: 'POSITION_OK',
        message: 'Good placement. Keep still.'
      });
      sendSse(res, {
        event: 'done',
        success: true,
        ...captureWithMock(fingerIndex, subjectId),
        message: 'Fingerprint captured clearly.'
      });
      res.end();
    }, 600);
    return;
  }

  if (PROVIDER !== 'morfin') {
    sendSse(res, {
      event: 'done',
      success: false,
      error: 'Live capture feedback is only implemented for the Morfin bridge provider.'
    });
    return res.end();
  }

  const child = spawn(
    MORFIN_COMMAND,
    ['capture-stream', String(fingerIndex), String(captureTimeoutMs), String(captureQuality)],
    { windowsHide: true }
  );

  let buffer = '';
  let finished = false;

  child.stdout.on('data', chunk => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      const event = parseJSONOutput(line);
      if (event.event === 'done') {
        finished = true;
      }
      sendSse(res, event);
    }
  });

  child.stderr.on('data', chunk => {
    const error = chunk.toString().trim();
    if (error) {
      sendSse(res, {
        event: 'error',
        success: false,
        error
      });
    }
  });

  child.on('error', error => {
    if (!finished) {
      sendSse(res, {
        event: 'done',
        success: false,
        error: error.message || 'Failed to start Morfin capture stream'
      });
    }
    res.end();
  });

  child.on('close', code => {
    if (buffer.trim()) {
      const event = parseJSONOutput(buffer.trim());
      if (event.event === 'done') {
        finished = true;
      }
      sendSse(res, event);
    }

    if (!finished && code !== 0) {
      sendSse(res, {
        event: 'done',
        success: false,
        error: 'Morfin capture stream ended before a fingerprint was captured'
      });
    }
    res.end();
  });

  req.on('close', () => {
    if (!child.killed) {
      child.kill();
    }
  });
});

app.post('/match', async (req, res) => {
  const { probeTemplate, galleryTemplate, threshold = 60 } = req.body;

  if (!probeTemplate || !galleryTemplate) {
    return res.status(400).json({
      success: false,
      error: 'probeTemplate and galleryTemplate are required'
    });
  }

  if (PROVIDER === 'mock') {
    return res.json(matchMockTemplates(probeTemplate, galleryTemplate));
  }

  if (PROVIDER === 'morfin') {
    try {
      const output = await runCommand(MORFIN_COMMAND, [
        'match',
        probeTemplate,
        galleryTemplate,
        String(threshold)
      ], 40000);
      return res.json(parseJSONOutput(output));
    } catch (error) {
      const commandResult = error.stdout ? parseJSONOutput(error.stdout.trim()) : null;
      if (commandResult && commandResult.success === false) {
        return res.status(500).json(commandResult);
      }

      return res.status(500).json({
        success: false,
        error: error.stderr || error.message || 'Morfin fingerprint match failed'
      });
    }
  }

  if (PROVIDER !== 'command' || !MATCH_COMMAND) {
    return res.status(500).json({
      success: false,
      error:
        'Mantra match provider is not configured. Set MANTRA_MATCH_COMMAND to a Morfin/MELO31 SDK wrapper executable.'
    });
  }

  try {
    const output = await runCommand(MATCH_COMMAND, [
      probeTemplate,
      galleryTemplate,
      String(threshold)
    ]);
    res.json(parseJSONOutput(output));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.stderr || error.message || 'Fingerprint match command failed'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Mantra bridge running on http://localhost:${PORT}`);
  console.log(`Provider: ${PROVIDER}`);
});
