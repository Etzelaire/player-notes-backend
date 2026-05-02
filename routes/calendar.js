const express = require('express');
const { google } = require('googleapis');
const { auth, isCoach } = require('../middleware/auth');

const router = express.Router();

// Get service account from environment or file
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('✅ Using FIREBASE_SERVICE_ACCOUNT from environment for Calendar API');
} else {
  try {
    serviceAccount = require('../firebase-service-account.json');
    console.log('✅ Using firebase-service-account.json for Calendar API');
  } catch (error) {
    console.error('⚠️ Service account file not found for Calendar API');
  }
}

// ═══════════════════════════════════════════════════════
// FETCH CALENDAR EVENTS - using Firebase service account
// ═══════════════════════════════════════════════════════
router.get('/events', auth, isCoach, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
    }

    if (!serviceAccount) {
      console.error('❌ Service account not configured for Calendar API');
      return res.status(500).json({ error: 'Service account not configured' });
    }

    if (!process.env.GOOGLE_CALENDAR_ID) {
      console.error('❌ GOOGLE_CALENDAR_ID not configured');
      return res.status(500).json({ error: 'Calendar ID not configured' });
    }

    console.log(`📅 Fetching calendar events for ${date}`);

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

    console.log(`🔍 Querying calendar ${process.env.GOOGLE_CALENDAR_ID} from ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

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
    console.error('❌ Error fetching calendar events:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      error: 'Failed to fetch calendar events',
      details: error.message
    });
  }
});

module.exports = router;
