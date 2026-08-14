import { PushSubscription } from "../models/subscription.model.js";

export const getVapidPublicKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

export const subscribeToNotifications = async (req, res) => {
  const { subscription } = req.body;
  
  if (!subscription) {
    return res.status(400).json({ error: "Subscription object is required." });
  }

  try {
    // Determine the user ID and role from the logged-in user
    const userId = req.user ? req.user._id : null;
    const role = req.user ? req.user.role : 'unknown';

    // Check if subscription already exists
    let existingSub = await PushSubscription.findOne({ endpoint: subscription.endpoint });
    
    if (existingSub) {
      existingSub.userId = userId;
      existingSub.role = role;
      await existingSub.save();
    } else {
      await PushSubscription.create({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userId: userId,
        role: role,
      });
    }

    res.status(201).json({ message: "Subscription saved successfully." });
  } catch (error) {
    console.error("Error saving subscription:", error);
    res.status(500).json({ error: "Failed to save subscription." });
  }
};
