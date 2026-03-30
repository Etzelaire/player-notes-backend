const express = require('express');
const bcrypt = require('bcryptjs');
const { User, LessonNote } = require('../models/User');
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

// Search for players by email (for autocomplete)
router.get('/search-players', auth, isCoach, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }
    
    const players = await User.find({
      role: 'player',
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ]
    })
    .select('name email')
    .limit(10);
    
    res.json(players);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add note to a student (coach only)
router.post('/players/:playerId/notes', auth, isCoach, async (req, res) => {
  try {
    const { text, lessonId, lessonTitle } = req.body;
    const { playerId } = req.params;

    console.log('===========================================');
    console.log('=== ADDING/UPDATING NOTE ===');
    console.log('Player ID:', playerId);
    console.log('Text length:', text?.length);
    console.log('Lesson ID:', lessonId);
    console.log('Lesson Title:', lessonTitle);
    console.log('===========================================');

    const player = await User.findById(playerId);
    if (!player || player.role !== 'player') {
      console.log('ERROR: Player not found or not a player role');
      return res.status(404).json({ message: 'Player not found' });
    }

    console.log('Player found:', player.name);
    console.log('Current notes count:', player.notes.length);
    
    // If this is a lesson note, check if one already exists
    if (lessonId) {
      console.log('This is a LESSON note, checking for existing...');
      
      // Log all existing notes with lessonId
      player.notes.forEach((note, index) => {
        console.log(`Note ${index}: lessonId=${note.lessonId}, lessonTitle=${note.lessonTitle}`);
      });
      
      const existingLessonNoteIndex = player.notes.findIndex(
        note => note.lessonId === lessonId
      );
      
      console.log('Existing note index:', existingLessonNoteIndex);
      
      if (existingLessonNoteIndex !== -1) {
        // Update existing lesson note
        console.log('UPDATING EXISTING lesson note at index:', existingLessonNoteIndex);
        console.log('Old text:', player.notes[existingLessonNoteIndex].text);
        console.log('New text:', text);
        
        player.notes[existingLessonNoteIndex].text = text;
        player.notes[existingLessonNoteIndex].updatedAt = new Date();
        
        await player.save();
        
        console.log('Note updated successfully');
        console.log('Updated note:', player.notes[existingLessonNoteIndex]);
        console.log('===========================================');
        
        return res.json(player);
      } else {
        console.log('NO existing note found, creating NEW lesson note');
      }
    } else {
      console.log('This is a REGULAR note (no lessonId)');
    }

    // Add new note
    console.log('CREATING NEW note');
    const newNote = {
      text,
      lessonId: lessonId || null,
      lessonTitle: lessonTitle || null,
      createdBy: req.user.id,
      createdAt: new Date()
    };
    
    console.log('New note object:', newNote);
    
    player.notes.push(newNote);

    await player.save();
    
    console.log('New note added successfully');
    console.log('Total notes now:', player.notes.length);
    console.log('===========================================');

    // Send notification
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
        console.log('✅ Notification sent to:', player.name);
      } catch (notifError) {
        console.error('❌ Error sending notification:', notifError);
      }
    }

    res.json(player);
  } catch (error) {
    console.error('ERROR in add note route:', error);
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
    
    const player = await User.findOne({ email, role: 'player' });
    
    if (!player) {
      return res.status(404).json({ message: 'No player found with this email. Ask them to register first.' });
    }
    
    const coach = await User.findById(req.user.id);
    if (coach.students && coach.students.includes(player._id)) {
      return res.status(400).json({ message: 'This player is already your student' });
    }
    
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


// Get all lesson notes (for coaches)
router.get('/lesson-notes', auth, isCoach, async (req, res) => {
  try {
    const lessonNotes = await LessonNote.find({ createdBy: req.user.id });
    
    // Clean up expired lesson notes
    const now = new Date();
    const expiredNotes = lessonNotes.filter(note => note.lessonEndTime < now);
    
    if (expiredNotes.length > 0) {
      await LessonNote.deleteMany({
        _id: { $in: expiredNotes.map(n => n._id) }
      });
      console.log(`Deleted ${expiredNotes.length} expired lesson notes`);
    }
    
    // Return only non-expired notes
    const activeNotes = lessonNotes.filter(note => note.lessonEndTime >= now);
    res.json(activeNotes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Save or update a lesson note (for coaches)
router.post('/lesson-notes', auth, isCoach, async (req, res) => {
  try {
    const { lessonId, lessonTitle, note, lessonEndTime } = req.body;
    
    console.log('=== SAVING LESSON NOTE ===');
    console.log('Lesson ID:', lessonId);
    console.log('Lesson Title:', lessonTitle);
    console.log('Note:', note);
    console.log('End Time:', lessonEndTime);
    
    // Check if note already exists
    let lessonNote = await LessonNote.findOne({ lessonId, createdBy: req.user.id });
    
    if (lessonNote) {
      // Update existing note
      console.log('Updating existing lesson note');
      lessonNote.note = note;
      lessonNote.lessonTitle = lessonTitle;
      lessonNote.lessonEndTime = lessonEndTime;
      lessonNote.updatedAt = new Date();
      await lessonNote.save();
    } else {
      // Create new note
      console.log('Creating new lesson note');
      lessonNote = await LessonNote.create({
        lessonId,
        lessonTitle,
        note,
        lessonEndTime,
        createdBy: req.user.id
      });
    }
    
    console.log('✅ Lesson note saved successfully');
    res.json(lessonNote);
  } catch (error) {
    console.error('Error saving lesson note:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a lesson note (for coaches)
router.delete('/lesson-notes/:lessonId', auth, isCoach, async (req, res) => {
  try {
    const { lessonId } = req.params;
    
    await LessonNote.deleteOne({ lessonId, createdBy: req.user.id });
    
    res.json({ message: 'Lesson note deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;