import webpush from 'web-push';
import { PushSubscription } from '../models/subscription.model.js';
import dotenv from 'dotenv';
dotenv.config();

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Typically the contact email for the push service
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send a notification to specific users based on their ID, role, or an array of identities.
 * 
 * @param {Object} options
 * @param {string[]} [options.userIds] - Array of user IDs to send to
 * @param {string[]} [options.roles] - Array of roles to send to (e.g. ['sales', 'manager'])
 * @param {Object} payload - The notification payload containing title, message, url, etc.
 */
export const sendPushNotification = async ({ userIds = [], roles = [] }, payload) => {
  try {
    const query = { $or: [] };
    
    if (userIds.length > 0) {
      query.$or.push({ userId: { $in: userIds } });
    }
    
    if (roles.length > 0) {
      query.$or.push({ role: { $in: roles } });
    }

    if (query.$or.length === 0) {
      return; // Nothing to send to
    }

    const subscriptions = await PushSubscription.find(query);
    
    const notificationPayload = JSON.stringify(payload);

    const pushPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys
          },
          notificationPayload
        );
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          // Subscription has expired or is no longer valid, remove it
          await PushSubscription.findByIdAndDelete(sub._id);
        } else {
          console.error('Error sending push notification:', error);
        }
      }
    });

    await Promise.all(pushPromises);
  } catch (error) {
    console.error('Error in sendPushNotification service:', error);
  }
};
