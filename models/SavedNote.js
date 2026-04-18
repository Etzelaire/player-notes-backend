const mongoose = require('mongoose');

const savedNoteSchema = new mongoose.Schema({
  coachId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  performanceBadge: {
    type: String,
    enum: ['excellent', 'good', 'average', 'needs_work', 'keep_trying', null],
    default: null
  },
  noteType: {
    type: String,
    enum: ['lesson', 'wisdom', null],
    default: null
  },
  sharedWith: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SavedNote', savedNoteSchema);