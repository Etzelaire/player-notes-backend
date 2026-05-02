const express = require('express');
const { google } = require('googleapis');
const { auth, isCoach } = require('../middleware/auth');
const admin = require('firebase-admin');

const router = express.Router();

// ═══════════════════════════════════════════════════════
// FETCH CALENDAR EVENTS - using Firebase service account
// ═══════════════════════════════════════════════════════
router.get('/events', auth, isCoach, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
    }

    console.log(`📅 Fetching calendar events for ${date}`);

    // Get service account credentials from Firebase
    const serviceAccount = admin.app().options.credential.toJSON();

    // Create JWT for service account
    const jwtClient = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/calendar.readonly']
    );

    // Authorize and create calendar client
    const calendar = google.calendar({ version: 'v3', auth: jwtClient });

    // Parse date and create time boundaries
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch events from calendar
    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];

    console.log(`✅ Retrieved ${events.length} events for ${date}`);

    res.json({
      date,
      events: events.map(event => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        location: event.location
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching calendar events:', error);
    res.status(500).json({
      error: 'Failed to fetch calendar events',
      details: error.message
    });
  }
});

module.exports = router;
