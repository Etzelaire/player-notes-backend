const mongoose = require('mongoose');

const skillRatingSchema = new mongoose.Schema(
  {
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ratings: {
      type: Map,
      of: Number, // skillId -> rating (0-7)
      default: {},
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index: one doc per coach-player pair
skillRatingSchema.index({ coachId: 1, playerId: 1 }, { unique: true });

module.exports = mongoose.model('SkillRating', skillRatingSchema);
