const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  const serviceAccount = require('../serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin initialized');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
}

// Send notification to a player
const sendNotificationToPlayer = async (fcmToken, title, body, data = {}) => {
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
    console.log('Notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

module.exports = { sendNotificationToPlayer };