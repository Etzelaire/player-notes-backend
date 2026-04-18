const express = require('express');
const router = express.Router();
const SavedNote = require('../models/SavedNote');
const Player = require('../models/Player');
const auth = require('../middleware/auth');

// Get all saved notes for coach
router.get('/', auth, async (req, res) => {
  try {
    const savedNotes = await SavedNote.find({ coachId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(savedNotes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching saved notes', error: error.message });
  }
});

// Create a new saved note
router.post('/', auth, async (req, res) => {
  try {
    const { content, performanceBadge, noteType } = req.body;
    
    const savedNote = new SavedNote({
      coachId: req.user._id,
      content,
      performanceBadge,
      noteType,
      sharedWith: []
    });
    
    await savedNote.save();
    res.status(201).json(savedNote);
  } catch (error) {
    res.status(500).json({ message: 'Error creating saved note', error: error.message });
  }
});

// Share saved note to student(s)
router.post('/:id/share', auth, async (req, res) => {
  try {
    const { studentIds } = req.body;
    const savedNote = await SavedNote.findOne({ 
      _id: req.params.id, 
      coachId: req.user._id 
    });
    
    if (!savedNote) {
      return res.status(404).json({ message: 'Saved note not found' });
    }
    
    // Add note to each student
    for (const studentId of studentIds) {
      const player = await Player.findById(studentId);
      
      if (player) {
        player.notes.push({
          text: savedNote.content,
          performanceBadge: savedNote.performanceBadge,
          noteType: savedNote.noteType,
          createdAt: new Date()
        });
        
        await player.save();
        
        // Track sharing
        savedNote.sharedWith.push({
          studentId,
          sharedAt: new Date()
        });
      }
    }
    
    await savedNote.save();
    res.json({ message: 'Note shared successfully', savedNote });
  } catch (error) {
    res.status(500).json({ message: 'Error sharing note', error: error.message });
  }
});

// Delete saved note
router.delete('/:id', auth, async (req, res) => {
  try {
    const savedNote = await SavedNote.findOneAndDelete({ 
      _id: req.params.id, 
      coachId: req.user._id 
    });
    
    if (!savedNote) {
      return res.status(404).json({ message: 'Saved note not found' });
    }
    
    res.json({ message: 'Saved note deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting saved note', error: error.message });
  }
});

module.exports = router;