const admin = require('firebase-admin');

let firebaseInitialized = false;

// Initialize Firebase Admin
const initializeFirebase = () => {
  if (firebaseInitialized) {
    console.log('Firebase Admin already initialized');
    return;
  }

  try {
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('Using FIREBASE_SERVICE_ACCOUNT from environment');
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      console.log('Using serviceAccountKey.json from file');
      serviceAccount = require('../serviceAccountKey.json');
    }
    
    if (!serviceAccount) {
      throw new Error('No Firebase service account found');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    console.error('Full error:', error);
  }
};

// Initialize immediately when module loads
initializeFirebase();

// Send notification to a player
const sendNotificationToPlayer = async (fcmToken, title, body, data = {}) => {
  if (!firebaseInitialized) {
    console.error('Firebase not initialized, attempting to initialize now...');
    initializeFirebase();
    
    if (!firebaseInitialized) {
      throw new Error('Failed to initialize Firebase Admin');
    }
  }

  if (!fcmToken) {
    console.log('No FCM token provided');
    return;
  }

  const message = {
    notification: {
      title,
      body
    },
    data: data,
    token: fcmToken,
    android: {
      priority: 'high',
      notification: {
        channelId: 'player_notes_channel',
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
        visibility: 'public'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          contentAvailable: true
        }
      },
      headers: {
        'apns-priority': '10'
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    throw error;
  }
};

module.exports = { sendNotificationToPlayer };