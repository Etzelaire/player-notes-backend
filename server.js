require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const admin = require('firebase-admin');

// Import routes
const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const savedNotesRouter = require('./routes/savedNotes');


// Initialize Express app FIRST
const app = express();

// Initialize Firebase Admin only if not already initialized
if (!admin.apps.length) {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('Using FIREBASE_SERVICE_ACCOUNT from environment');
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    console.log('Using firebase-service-account.json file');
    try {
      serviceAccount = require('./firebase-service-account.json');
    } catch (error) {
      console.log('⚠️ Firebase service account not found, push notifications will not work');
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized successfully');
  } else {
    console.log('⚠️ Firebase Admin not initialized - push notifications disabled');
  }
} else {
  console.log('✅ Firebase Admin already initialized');
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes - NOW you can use app.use()
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/saved-notes', savedNotesRouter);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});