const mongoose = require('mongoose');

const lessonNoteSchema = new mongoose.Schema({
  lessonId: {
    type: String,
    required: true,
    unique: true
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

const noteSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
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
    type: Date
  }
});

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
});

const LessonNote = mongoose.model('LessonNote', lessonNoteSchema);
const User = mongoose.model('User', userSchema);

module.exports = {
  User,
  LessonNote
};