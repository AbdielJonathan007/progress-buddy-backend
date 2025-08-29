// routes/notifications.js
import express from 'express';

let db = null;

export function setDatabase(database) {
  db = database;
}

const router = express.Router();

// Simple notification routes without email dependencies
router.post('/achievement', async (req, res) => {
  try {
    console.log('Achievement notification would be sent:', req.body);
    res.json({ message: 'Notification logged (email disabled for now)' });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ error: 'Notification service temporarily disabled' });
  }
});

router.post('/goal-completed', async (req, res) => {
  try {
    console.log('Goal completed notification would be sent:', req.body);
    res.json({ message: 'Goal completion logged (email disabled for now)' });
  } catch (error) {
    console.error('Goal notification error:', error);
    res.status(500).json({ error: 'Notification service temporarily disabled' });
  }
});

router.post('/weekly-summary', async (req, res) => {
  try {
    console.log('Weekly summary would be sent:', req.body);
    res.json({ message: 'Weekly summary logged (email disabled for now)' });
  } catch (error) {
    console.error('Weekly summary error:', error);
    res.status(500).json({ error: 'Notification service temporarily disabled' });
  }
});

export default router;