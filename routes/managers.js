const express = require('express');
const { User } = require('../models/User');
const { auth, isManager } = require('../middleware/auth');
const { google } = require('googleapis');

const router = express.Router();

// Get service account from environment or file
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('✅ Using FIREBASE_SERVICE_ACCOUNT for Manager Calendar API');
} else {
  try {
    serviceAccount = require('../firebase-service-account.json');
    console.log('✅ Using firebase-service-account.json for Manager Calendar API');
  } catch (error) {
    console.error('⚠️ Service account file not found for Manager Calendar API');
  }
}

// ═══════════════════════════════════════════════════════
// MANAGER ROUTES
// ═══════════════════════════════════════════════════════

// Get manager's connected coach
// GET /api/managers/my-coach
router.get('/my-coach', auth, isManager, async (req, res) => {
  try {
    const managerId = req.user.id;

    // Find which coach has this manager in their students array
    const coach = await User.findOne({
      role: 'coach',
      students: managerId
    }).select('_id name email');

    if (!coach) {
      return res.status(404).json({ error: 'No connected coach found' });
    }

    res.json(coach);
  } catch (error) {
    console.error('Error loading manager coach:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get coach's schedule (manager view)
// GET /api/managers/coach-schedule?date=2026-05-04
router.get('/coach-schedule', auth, isManager, async (req, res) => {
  try {
    const managerId = req.user.id;
    const { date } = req.query; // Format: YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
    }

    // Find the manager's coach
    const coach = await User.findOne({
      role: 'coach',
      students: managerId
    });

    if (!coach) {
      return res.status(403).json({ error: 'No connected coach' });
    }

    // Fetch coach's calendar events using service account
    if (!serviceAccount) {
      console.error('❌ Service account not configured for Coach Calendar API');
      return res.status(500).json({ error: 'Service account not configured' });
    }

    if (!process.env.GOOGLE_CALENDAR_ID) {
      console.error('❌ GOOGLE_CALENDAR_ID not configured');
      return res.status(500).json({ error: 'Calendar ID not configured' });
    }

    console.log(`📅 Fetching coach calendar events for ${date}`);

    // Create JWT for service account
    const jwtClient = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/calendar.readonly']
    );

    // Authorize and create calendar client
    const calendar = google.calendar({ version: 'v3', auth: jwtClient });

    // Parse date as Singapore timezone (UTC+8)
    const [year, month, day] = date.split('-').map(Number);

    // Singapore is UTC+8, so:
    // May 2 00:00 Singapore = May 1 16:00 UTC
    // May 2 23:59 Singapore = May 2 15:59 UTC
    // Query from (day-1) 16:00 UTC to day 16:00 UTC

    const timeMin = new Date(Date.UTC(year, month - 1, day - 1, 16, 0, 0)).toISOString();
    const timeMax = new Date(Date.UTC(year, month - 1, day, 16, 0, 0)).toISOString();

    console.log(`🔍 Querying coach calendar for Singapore date ${date}`);

    // Fetch events from calendar
    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];

    console.log(`✅ Retrieved ${events.length} events for ${date}`);

    res.json({
      events: events
    });
  } catch (error) {
    console.error('Error loading coach schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get coach's students list (manager view)
// GET /api/managers/coach-students
router.get('/coach-students', auth, isManager, async (req, res) => {
  try {
    const managerId = req.user.id;

    // Find manager's coach
    const coach = await User.findOne({
      role: 'coach',
      students: managerId
    }).populate({
      path: 'students',
      select: 'name email role'
    });

    if (!coach) {
      return res.status(403).json({ error: 'No connected coach' });
    }

    // Separate managers and players for display
    const students = coach.students.map(student => ({
      _id: student._id,
      name: student.name,
      email: student.email,
      role: student.role,
      isManager: student.role === 'manager'
    }));

    res.json({
      coachId: coach._id,
      coachName: coach.name,
      students: students
    });
  } catch (error) {
    console.error('Error loading coach students:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
