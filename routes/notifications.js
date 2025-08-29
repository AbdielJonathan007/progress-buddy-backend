import express from 'express';
import { Resend } from 'resend';

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Database instance will be injected
let db;
export function setDatabase(databaseInstance) {
  db = databaseInstance;
}

// Send achievement notification
router.post('/achievement', async (req, res) => {
  try {
    const { activity_id, message } = req.body;
    if (!activity_id) return res.status(400).json({ error: 'Missing activity_id' });

    const activity = await db.get('SELECT * FROM activities WHERE id = ?', [activity_id]);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    if (!activity.buddy_email) return res.status(400).json({ error: 'No buddy email for this activity' });

    const recentLogs = await db.all(`
      SELECT * FROM logs 
      WHERE activity_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [activity_id]);

    const logSummary = recentLogs.map(log => {
      const details = log.text || log.note || log.description || log.entry || 'No details';
      return `• ${details} (${log.created_at})`;
    }).join('<br>');
    const html = `
      <p>Your buddy made an achievement:</p>
      <p>${message}</p>
      <p>Recent progress:</p>
      <p>${logSummary}</p>
    `;

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: activity.buddy_email,
      subject: 'Progress Buddy: Achievement Notification',
      html,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send goal completion notification
router.post('/goal-completed', async (req, res) => {
  try {
    const { activity_id } = req.body;
    if (!activity_id) return res.status(400).json({ error: 'Missing activity_id' });

    const activity = await db.get('SELECT * FROM activities WHERE id = ?', [activity_id]);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    if (!activity.buddy_email) return res.status(400).json({ error: 'No buddy email for this activity' });

    const html = `
      <p>Congratulations! Your buddy completed the goal:</p>
      <strong>${activity.name}</strong>
      <p>Description: ${activity.description}</p>
    `;

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: activity.buddy_email,
      subject: 'Progress Buddy: Goal Completed!',
      html,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send weekly progress summary
router.post('/weekly-summary', async (req, res) => {
  try {
    const { activity_id } = req.body;
    if (!activity_id) return res.status(400).json({ error: 'Missing activity_id' });

    const activity = await db.get('SELECT * FROM activities WHERE id = ?', [activity_id]);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    if (!activity.buddy_email) return res.status(400).json({ error: 'No buddy email for this activity' });

    const logs = await db.all(`
      SELECT * FROM logs 
      WHERE activity_id = ? 
      AND created_at >= datetime('now', '-7 days')
      ORDER BY created_at DESC
    `, [activity_id]);

    const logSummary = logs.length
      ? logs.map(log => {
          const details = log.note || log.description || log.entry || log.text || 'No details';
          return `• ${details} (${log.created_at})`;
        }).join('<br>')
      : 'No progress logged this week.';

    const html = `
      <p>Weekly Progress Summary for Goal: <strong>${activity.name}</strong></p>
      <p>${logSummary}</p>
    `;

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: activity.buddy_email,
      subject: 'Progress Buddy: Weekly Progress Summary',
      html,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Notify when a new goal is set
router.post('/', async (req, res) => {
  const { email, goal, description, measurable, timebound, relevant } = req.body;
  try {
    const html = `
      <h2>Your buddy set a new goal!</h2>
      <strong>${goal}</strong>
      <p>Description: ${description}</p>
      <p>Target: ${measurable}</p>
      <p>Due: ${timebound}</p>
      <p>Why this matters: ${relevant}</p>
    `;
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Your Progress Buddy Goal',
      html,
    });
    console.log('Resend API result:', result);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;