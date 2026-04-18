const express = require('express');
const router = express.Router();
const SavedNote = require('../models/SavedNote');
const { User } = require('../models/User');
const { auth, isCoach } = require('../middleware/auth');
const mongoose = require('mongoose');

// Get all saved notes for coach
router.get('/', auth, isCoach, async (req, res) => {
  try {
    const savedNotes = await SavedNote.find({ coachId: req.user.id })
      .sort({ createdAt: -1 });
    res.json(savedNotes);
  } catch (error) {
    console.error('Error fetching saved notes:', error);
    res.status(500).json({ message: 'Error fetching saved notes', error: error.message });
  }
});

// Create a new saved note
router.post('/', auth, isCoach, async (req, res) => {
  try {
    const { content, performanceBadge, noteType } = req.body;
    
    console.log('=== CREATING SAVED NOTE ===');
    console.log('Content:', content);
    console.log('Badge:', performanceBadge);
    console.log('Type:', noteType);
    
    const savedNote = new SavedNote({
      coachId: req.user.id,
      content,
      performanceBadge: performanceBadge || null,
      noteType: noteType || null,
      sharedWith: []
    });
    
    await savedNote.save();
    
    console.log('✅ Saved note created:', savedNote._id);
    
    res.status(201).json(savedNote);
  } catch (error) {
    console.error('❌ Error creating saved note:', error);
    res.status(500).json({ message: 'Error creating saved note', error: error.message });
  }
});

// Share saved note to student(s)
router.post('/:id/share', auth, isCoach, async (req, res) => {
  try {
    const { studentIds } = req.body;
    const savedNote = await SavedNote.findOne({ 
      _id: req.params.id, 
      coachId: req.user.id 
    });
    
    if (!savedNote) {
      return res.status(404).json({ message: 'Saved note not found' });
    }
    
    console.log('=== SHARING SAVED NOTE ===');
    console.log('Note ID:', savedNote._id);
    console.log('Student IDs:', studentIds);
    console.log('Badge:', savedNote.performanceBadge);
    console.log('Type:', savedNote.noteType);
    
    // Add note to each student using raw MongoDB $push
    for (const studentId of studentIds) {
      const student = await User.findById(studentId);
      
      if (student && student.role === 'player') {
        const newNoteId = new mongoose.Types.ObjectId();
        const now = new Date();
        
        // Use $push to add note to student's notes array
        await User.updateOne(
          { _id: studentId },
          {
            $push: {
              notes: {
                _id: newNoteId,
                text: savedNote.content,
                performanceBadge: savedNote.performanceBadge || null,
                noteType: savedNote.noteType || null,
                lessonId: null,
                lessonTitle: null,
                createdBy: req.user.id,
                createdAt: now,
                updatedAt: null
              }
            }
          }
        );
        
        // Track sharing in savedNote
        savedNote.sharedWith.push({
          studentId,
          sharedAt: new Date()
        });
        
        console.log(`✅ Note added to student: ${student.name}`);
      }
    }
    
    await savedNote.save();
    
    console.log('✅ Note shared successfully');
    console.log('Total shared with:', savedNote.sharedWith.length);
    
    res.json({ message: 'Note shared successfully', savedNote });
  } catch (error) {
    console.error('❌ Error sharing note:', error);
    res.status(500).json({ message: 'Error sharing note', error: error.message });
  }
});

// Delete saved note
router.delete('/:id', auth, isCoach, async (req, res) => {
  try {
    const savedNote = await SavedNote.findOneAndDelete({ 
      _id: req.params.id, 
      coachId: req.user.id 
    });
    
    if (!savedNote) {
      return res.status(404).json({ message: 'Saved note not found' });
    }
    
    console.log('✅ Saved note deleted:', savedNote._id);
    
    res.json({ message: 'Saved note deleted' });
  } catch (error) {
    console.error('❌ Error deleting saved note:', error);
    res.status(500).json({ message: 'Error deleting saved note', error: error.message });
  }
});

module.exports = router;