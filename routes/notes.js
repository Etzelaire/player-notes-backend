const express = require('express');
const bcrypt = require('bcryptjs');
const { User, LessonNote } = require('../models/User');
const { auth, isCoach } = require('../middleware/auth');
const { sendNotificationToPlayer } = require('../utils/notifications');
const mongoose = require('mongoose');

const router = express.Router();

// ═══════════════════════════════════════════════════════
// PLAYER ROUTES
// ═══════════════════════════════════════════════════════

// Get my notes (for players)
router.get('/my-notes', auth, async (req, res) => {
  try {
    console.log('═══════════════════════════════════════');
    console.log('📥 GET /my-notes called');
    console.log('Player ID:', req.user.id);
    
    const user = await User.findById(req.user.id).select('name notes');
    
    console.log('Player:', user.name);
    console.log('Notes count:', user.notes.length);
    
    if (user.notes.length > 0) {
      console.log('First 3 notes:');
      user.notes.slice(0, 3).forEach((note, i) => {
        console.log(`  Note ${i}:`, {
          id: note._id,
          badge: note.performanceBadge,
          text: note.text.substring(0, 30)
        });
      });
    }
    
    console.log('Sending response with structure:', {
      name: user.name,
      notesCount: user.notes.length
    });
    console.log('═══════════════════════════════════════');
    
    res.json(user);
  } catch (error) {
    console.error('Error loading notes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════
// COACH ROUTES
// ═══════════════════════════════════════════════════════

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

// Add note to a student (coach only) - RAW MONGODB VERSION
router.post('/players/:playerId/notes', auth, isCoach, async (req, res) => {
  try {
    const { text, lessonId, lessonTitle, performanceBadge, noteType } = req.body;
    const { playerId } = req.params;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔵 POST - ADDING NOTE');
    console.log('Badge:', performanceBadge);
    console.log('Type:', noteType);
    console.log('═══════════════════════════════════════════════════════════');

    // Validate player exists
    const player = await User.findById(playerId);
    if (!player || player.role !== 'player') {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Check for existing lesson note
    if (lessonId) {
      const existingIndex = player.notes.findIndex(n => n.lessonId === lessonId);
      
      if (existingIndex !== -1) {
        // Update existing lesson note using raw MongoDB
        const result = await User.updateOne(
          { 
            _id: playerId,
            'notes._id': player.notes[existingIndex]._id
          },
          {
            $set: {
              'notes.$.text': text,
              'notes.$.performanceBadge': performanceBadge || null,
              'notes.$.noteType': noteType || null,
              'notes.$.updatedAt': new Date()
            }
          }
        );
        
        console.log('✅ Updated existing lesson note');
        const updatedPlayer = await User.findById(playerId);
        return res.json(updatedPlayer);
      }
    }

    // Create new note with explicit _id
    const newNoteId = new mongoose.Types.ObjectId();
    const now = new Date();
    
    // Use raw MongoDB $push with ALL fields explicitly
    const result = await User.updateOne(
      { _id: playerId },
      {
        $push: {
          notes: {
            _id: newNoteId,
            text: text,
            performanceBadge: performanceBadge || null,
            noteType: noteType || null,
            lessonId: lessonId || null,
            lessonTitle: lessonTitle || null,
            createdBy: new mongoose.Types.ObjectId(req.user.id),
            createdAt: now,
            updatedAt: null
          }
        }
      }
    );

    if (result.modifiedCount === 0) {
      console.error('❌ MongoDB update failed');
      return res.status(500).json({ message: 'Failed to save note' });
    }

    console.log('✅ MongoDB $push successful');

    // Verify what was actually saved
    const verifyPlayer = await User.findById(playerId);
    const savedNote = verifyPlayer.notes.id(newNoteId);
    
    console.log('───────────────────────────────────────');
    console.log('VERIFICATION:');
    console.log('  Badge saved:', savedNote.performanceBadge);
    console.log('  Type saved:', savedNote.noteType);
    console.log('  Badge is null?', savedNote.performanceBadge === null);
    console.log('  Type is null?', savedNote.noteType === null);
    console.log('  Badge is undefined?', savedNote.performanceBadge === undefined);
    console.log('  Type is undefined?', savedNote.noteType === undefined);
    console.log('═══════════════════════════════════════════════════════════');

    // Send notification
    if (player.fcmToken) {
      try {
        const coach = await User.findById(req.user.id);
        await sendNotificationToPlayer(
          player.fcmToken,
          'New Note from Coach',
          `${coach.name}: ${text.substring(0, 100)}`,
          { type: 'new_note', noteId: newNoteId.toString() }
        );
      } catch (notifError) {
        console.error('⚠️ Notification error:', notifError.message);
      }
    }

    // Return fresh player data
    const freshPlayer = await User.findById(playerId);
    res.json(freshPlayer);
    
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════════');
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
    const { text, performanceBadge, noteType } = req.body;  // ADD noteType
    const { playerId, noteId } = req.params;

    console.log('=== UPDATING NOTE ===');
    console.log('Note ID:', noteId);
    console.log('New text:', text);
    console.log('New badge:', performanceBadge);
    console.log('New type:', noteType);  // ADD THIS

    const player = await User.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const note = player.notes.id(noteId);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    note.text = text;
    note.performanceBadge = performanceBadge !== undefined ? performanceBadge : note.performanceBadge;
    note.noteType = noteType !== undefined ? noteType : note.noteType;  // ADD THIS
    note.updatedAt = new Date();
    
    await player.save();
    
    console.log('Note updated successfully');
    
    res.json(player);
  } catch (error) {
    console.error('Error updating note:', error);
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

// ═══════════════════════════════════════════════════════
// LESSON NOTES ROUTES
// ═══════════════════════════════════════════════════════

// Get all lesson notes (for coaches)
router.get('/lesson-notes', auth, isCoach, async (req, res) => {
  try {
    console.log('=== GETTING LESSON NOTES ===');
    console.log('Coach ID:', req.user.id);
    
    const lessonNotes = await LessonNote.find({ createdBy: req.user.id });
    
    console.log('Found', lessonNotes.length, 'lesson notes');
    
    const now = new Date();
    const expiredNotes = lessonNotes.filter(note => note.lessonEndTime < now);
    
    if (expiredNotes.length > 0) {
      await LessonNote.deleteMany({
        _id: { $in: expiredNotes.map(n => n._id) }
      });
      console.log(`Deleted ${expiredNotes.length} expired lesson notes`);
    }
    
    const activeNotes = lessonNotes.filter(note => note.lessonEndTime >= now);
    console.log('Returning', activeNotes.length, 'active notes');
    console.log('===========================================');
    
    res.json(activeNotes);
  } catch (error) {
    console.error('Error getting lesson notes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



// Check and update milestone progress
router.post('/check-milestone', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Count lesson notes
    const lessonNotes = user.notes.filter(note => note.noteType === 'lesson');
    const lessonCount = lessonNotes.length;
    
    // Calculate current milestone (10, 20, 30, etc.)
    const currentMilestone = Math.floor(lessonCount / 10) * 10;
    
    // Check if milestone exists and hasn't been celebrated
    let shouldCelebrate = false;
    let milestoneData = null;
    
    if (currentMilestone > 0) {
      const milestoneKey = `milestone_${currentMilestone}`;
      const milestone = user.milestones?.get(milestoneKey);
      
      if (!milestone || !milestone.celebrationShown) {
        // Mark milestone as achieved and celebrated
        if (!user.milestones) {
          user.milestones = new Map();
        }
        
        user.milestones.set(milestoneKey, {
          achieved: true,
          achievedAt: new Date(),
          celebrationShown: true
        });
        
        await user.save();
        
        shouldCelebrate = true;
        milestoneData = {
          milestone: currentMilestone,
          lessonCount: lessonCount,
          nextMilestone: currentMilestone + 10
        };
        
        console.log(`🎉 Milestone ${currentMilestone} achieved for user ${user.name}`);
      }
    }
    
    res.json({
      shouldCelebrate,
      milestoneData,
      lessonCount,
      nextMilestone: (Math.floor(lessonCount / 10) + 1) * 10,
      progress: lessonCount % 10
    });
    
  } catch (error) {
    console.error('Error checking milestone:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reset milestone celebration (for testing)
router.post('/reset-milestone/:milestone', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const milestoneKey = `milestone_${req.params.milestone}`;
    
    if (user.milestones?.has(milestoneKey)) {
      user.milestones.delete(milestoneKey);
      await user.save();
    }
    
    res.json({ message: `Milestone ${req.params.milestone} reset` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ================================================================
// UPDATED BACKEND ROUTE IN routes/notes.js
// Replace the POST /lesson-notes route (around line 393)
// ================================================================

router.post('/lesson-notes', auth, isCoach, async (req, res) => {
  try {
    const { lessonId, lessonTitle, note, lessonEndTime, performanceBadge, noteType } = req.body;
    
    console.log('===========================================');
    console.log('=== SAVING LESSON NOTE ===');
    console.log('Coach ID:', req.user.id);
    console.log('Lesson ID:', lessonId);
    console.log('Lesson Title:', lessonTitle);
    console.log('Note:', note);
    console.log('End Time:', lessonEndTime);
    console.log('Performance Badge:', performanceBadge);  // ← Add this
    console.log('Note Type:', noteType);                  // ← Add this
    
    // Check if note already exists for this coach and lesson
    let lessonNote = await LessonNote.findOne({ 
      lessonId, 
      createdBy: req.user.id 
    });
    
    if (lessonNote) {
      // Update existing note
      console.log('Found existing note, updating...');
      lessonNote.note = note;
      lessonNote.lessonTitle = lessonTitle;
      lessonNote.lessonEndTime = lessonEndTime;
      lessonNote.performanceBadge = performanceBadge;  // ← Add this
      lessonNote.noteType = noteType;                  // ← Add this
      lessonNote.updatedAt = new Date();
      await lessonNote.save();
      console.log('✅ Updated existing note');
    } else {
      // Create new note
      console.log('Creating new lesson note...');
      lessonNote = await LessonNote.create({
        lessonId,
        lessonTitle,
        note,
        lessonEndTime,
        performanceBadge,   // ← Add this
        noteType,           // ← Add this
        createdBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Created new lesson note');
    }
    
    console.log('===========================================');
    
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
    
    console.log('=== DELETING LESSON NOTE ===');
    console.log('Lesson ID:', lessonId);
    
    await LessonNote.deleteOne({ lessonId, createdBy: req.user.id });
    
    console.log('✅ Lesson note deleted');
    
    res.json({ message: 'Lesson note deleted' });
  } catch (error) {
    console.error('Error deleting lesson note:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;