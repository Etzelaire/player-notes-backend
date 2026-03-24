const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { auth, isCoach } = require('../middleware/auth');

const router = express.Router();

// Add this at the top with other imports
const { sendNotificationToPlayer } = require('../utils/notifications');

// Get my notes (for players)
router.get('/my-notes', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name notes');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all players (for coaches)
router.get('/players', auth, isCoach, async (req, res) => {
  try {
    const players = await User.find({ role: 'player' })
      .select('name email notes createdAt')
      .sort({ name: 1 });
    res.json(players);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add note to a player (coach only)
router.post('/players/:playerId/notes', auth, isCoach, async (req, res) => {
  try {
    const { text } = req.body;
    const { playerId } = req.params;

    const player = await User.findById(playerId);
    if (!player || player.role !== 'player') {
      return res.status(404).json({ message: 'Player not found' });
    }

    player.notes.push({
      text,
      createdBy: req.user.id,
      createdAt: new Date()
    });

    await player.save();

    // Send push notification to player
    if (player.fcmToken) {
      try {
        const coach = await User.findById(req.user.id);
        await sendNotificationToPlayer(
          player.fcmToken,
          'New Note from Coach',
          `${coach.name}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
          {
            type: 'new_note',
            noteId: player.notes[player.notes.length - 1]._id.toString()
          }
        );
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
        // Don't fail the request if notification fails
      }
    }

    res.json(player);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a note (coach only)
router.delete('/players/:playerId/notes/:noteId', auth, isCoach, async (req, res) => {
  try {
    const { playerId, noteId } = req.params;

    const player = await User.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    player.notes = player.notes.filter(note => note._id.toString() !== noteId);
    await player.save();

    res.json(player);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update/edit a note (coach only)
router.put('/players/:playerId/notes/:noteId', auth, isCoach, async (req, res) => {
  try {
    const { text } = req.body;
    const { playerId, noteId } = req.params;

    const player = await User.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const note = player.notes.id(noteId);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    note.text = text;
    note.updatedAt = new Date();
    
    await player.save();
    res.json(player);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new player (coach only)
router.post('/players', auth, isCoach, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const player = new User({
      name,
      email,
      password: hashedPassword,
      role: 'player'
    });

    await player.save();
    res.status(201).json(player);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a player (coach only) - ADD THIS ROUTE
router.delete('/players/:playerId', auth, isCoach, async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await User.findById(playerId);
    if (!player || player.role !== 'player') {
      return res.status(404).json({ message: 'Player not found' });
    }

    await User.findByIdAndDelete(playerId);
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Add this route before module.exports
router.post('/save-token', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    
    await User.findByIdAndUpdate(req.user.id, { fcmToken });
    
    res.json({ message: 'Token saved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;