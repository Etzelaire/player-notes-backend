const express = require('express');
const { User } = require('../models/User');
const { auth, isManager } = require('../middleware/auth');

const router = express.Router();

// ═══════════════════════════════════════════════════════
// MANAGER ROUTES
// ═══════════════════════════════════════════════════════

// Get manager's connected coach
// GET /api/managers/my-coach
router.get('/my-coach', auth, isManager, async (req, res) => {
  try {
    const managerId = req.user.id;

    // Find which coach has this manager in their students array
    const coach = await User.findOne({
      role: 'coach',
      students: managerId
    }).select('_id name email');

    if (!coach) {
      return res.status(404).json({ error: 'No connected coach found' });
    }

    res.json(coach);
  } catch (error) {
    console.error('Error loading manager coach:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get coach's schedule (manager view)
// GET /api/managers/coach-schedule?date=2026-05-04
router.get('/coach-schedule', auth, isManager, async (req, res) => {
  try {
    const managerId = req.user.id;
    const { date } = req.query; // Format: YYYY-MM-DD

    // Find the manager's coach
    const coach = await User.findOne({
      role: 'coach',
      students: managerId
    });

    if (!coach) {
      return res.status(403).json({ error: 'No connected coach' });
    }

    // Return empty lessons array for now
    // In a real app with Lesson model, you would query:
    // const lessons = await Lesson.find({
    //   coachId: coach._id,
    //   date: date
    // }).populate('studentId', 'name role').sort({ time: 1 });

    res.json({
      coachId: coach._id,
      coachName: coach.name,
      date: date,
      lessons: []
    });
  } catch (error) {
    console.error('Error loading coach schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get coach's students list (manager view)
// GET /api/managers/coach-students
router.get('/coach-students', auth, isManager, async (req, res) => {
  try {
    const managerId = req.user.id;

    // Find manager's coach
    const coach = await User.findOne({
      role: 'coach',
      students: managerId
    }).populate({
      path: 'students',
      select: 'name email role'
    });

    if (!coach) {
      return res.status(403).json({ error: 'No connected coach' });
    }

    // Separate managers and players for display
    const students = coach.students.map(student => ({
      _id: student._id,
      name: student.name,
      email: student.email,
      role: student.role,
      isManager: student.role === 'manager'
    }));

    res.json({
      coachId: coach._id,
      coachName: coach.name,
      students: students
    });
  } catch (error) {
    console.error('Error loading coach students:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
