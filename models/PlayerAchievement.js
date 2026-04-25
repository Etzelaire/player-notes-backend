const mongoose = require('mongoose');

const playerAchievementSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    achievementId: {
      type: String,
      required: true,
    },
    unlockedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// One record per player × achievement — upsert-safe
playerAchievementSchema.index({ playerId: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model('PlayerAchievement', playerAchievementSchema);
