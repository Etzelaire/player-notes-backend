const mongoose = require('mongoose');

// ═══════════════════════════════════════════════════════
// LESSON NOTE SCHEMA (separate collection)
// ═══════════════════════════════════════════════════════
const lessonNoteSchema = new mongoose.Schema({
  lessonId: {
    type: String,
    required: true
  },
  lessonTitle: {
    type: String,
    required: true
  },
  note: {
    type: String,
    required: true
  },
  lessonEndTime: {
    type: Date,
    required: true
  },
  // ✅ ADD THESE FIELDS FOR LESSON NOTE BADGES
  performanceBadge: {
    type: String,
    enum: ['excellent', 'good', 'average', 'needs_work', 'keep_trying', null],
    default: null
  },
  noteType: {
    type: String,
    enum: ['lesson', 'wisdom', null],
    default: 'lesson'  // ← Auto-default to 'lesson'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
});

lessonNoteSchema.index({ lessonId: 1, createdBy: 1 }, { unique: true });

// ═══════════════════════════════════════════════════════
// NOTE SCHEMA (embedded in User)
// ═══════════════════════════════════════════════════════
const noteSchema = new mongoose.Schema({
  text: {
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
    enum: ['lesson', 'wisdom', 'general', null],  // ← Add 'general'
    default: null
  },
  lessonId: {
    type: String,
    default: null
  },
  lessonTitle: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: null
  },

  // ✅ TRACKING FIELDS FOR ANALYTICS
  viewCount: { 
    type: Number, 
    default: 0 
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastReadAt: { 
    type: Date, 
    default: null 
  },
  lastViewedAt: {
    type: Date,
    default: null
  }
}, { 
  _id: true,
  strict: false,
  minimize: false
});

// ═══════════════════════════════════════════════════════
// USER SCHEMA
// ═══════════════════════════════════════════════════════
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['coach', 'player'],
    default: 'player'
  },
  fcmToken: {
    type: String,
    default: null
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  notes: [noteSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  strict: false,
  minimize: false
});

userSchema.index({ email: 1 }, { unique: true });

const LessonNote = mongoose.model('LessonNote', lessonNoteSchema);
const User = mongoose.model('User', userSchema);

module.exports = {
  User,
  LessonNote
};