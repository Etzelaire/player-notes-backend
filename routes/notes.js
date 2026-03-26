const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { auth, isCoach } = require('../middleware/auth');
const { sendNotificationToPlayer } = require('../utils/notifications');

const router = express.Router();

// Get my notes (for players)
router.get('/my-notes', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name notes');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get coach's students (for coaches)
router.get('/players', auth, isCoach, async (req, res) => {
  try {
    const coach = await User.findById(req.user.id).populate({
      path: 'students',
      select: 'name email notes createdAt'
    });
    
    const students = coach.students || [];
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add note to a student (coach only)
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

    console.log('=== SENDING NOTIFICATION ===');
    console.log('Player:', player.name);
    console.log('Player FCM Token:', player.fcmToken);

    // Send push notification to player
    if (player.fcmToken) {
      try {
        const coach = await User.findById(req.user.id);
        console.log('Coach:', coach.name);
        console.log('Note text:', text.substring(0, 50));
        
        await sendNotificationToPlayer(
          player.fcmToken,
          'New Note from Coach',
          `${coach.name}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
          {
            type: 'new_note',
            noteId: player.notes[player.notes.length - 1]._id.toString()
          }
        );
        console.log('✅ Notification sent successfully to:', player.name);
      } catch (notifError) {
        console.error('❌ Error sending notification:', notifError);
      }
    } else {
      console.log('⚠️ Player has no FCM token:', player.name);
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

// Add a student to coach's list (coach only)
router.post('/students', auth, isCoach, async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find the player by email
    const player = await User.findOne({ email, role: 'player' });
    
    if (!player) {
      return res.status(404).json({ message: 'No player found with this email. Ask them to register first.' });
    }
    
    // Check if already added
    const coach = await User.findById(req.user.id);
    if (coach.students && coach.students.includes(player._id)) {
      return res.status(400).json({ message: 'This player is already your student' });
    }
    
    // Add student to coach's list
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { students: player._id }
    });
    
    res.json({ message: 'Student added successfully', student: player });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove a student from coach's list (coach only)
router.delete('/students/:studentId', auth, isCoach, async (req, res) => {
  try {
    const { studentId } = req.params;
    
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { students: studentId }
    });
    
    res.json({ message: 'Student removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Save FCM token
router.post('/save-token', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    
    console.log('=== SAVING FCM TOKEN ===');
    console.log('User ID:', req.user.id);
    console.log('Token:', fcmToken);
    
    const user = await User.findByIdAndUpdate(
      req.user.id, 
      { fcmToken },
      { new: true }
    );
    
    console.log('Token saved for user:', user.name);
    console.log('User FCM Token:', user.fcmToken);
    
    res.json({ message: 'Token saved successfully' });
  } catch (error) {
    console.error('Error saving token:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;