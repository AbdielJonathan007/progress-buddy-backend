import express from 'express';

const router = express.Router();

// Database instance will be injected
let db;

export function setDatabase(databaseInstance) {
  db = databaseInstance;
}

// Get all logs (optionally filtered by activity_id)
router.get('/', async (req, res) => {
  try {
    const { activity_id } = req.query;
    
    let sql = 'SELECT l.*, a.name as activity_name FROM logs l JOIN activities a ON l.activity_id = a.id';
    let params = [];
    
    if (activity_id) {
      sql += ' WHERE l.activity_id = ?';
      params.push(activity_id);
    }
    
    sql += ' ORDER BY l.created_at DESC';
    
    const logs = await db.all(sql, params);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get single log by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const log = await db.get(`
      SELECT l.*, a.name as activity_name 
      FROM logs l 
      JOIN activities a ON l.activity_id = a.id 
      WHERE l.id = ?
    `, [id]);
    
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }
    
    res.json(log);
  } catch (error) {
    console.error('Error fetching log:', error);
    res.status(500).json({ error: 'Failed to fetch log' });
  }
});

// Create new log entry
router.post('/', async (req, res) => {
  try {
    const { activity_id, text, metrics } = req.body;

    // Validate required fields
    if (!activity_id || !text) {
      return res.status(400).json({ 
        error: 'Missing required fields: activity_id, text' 
      });
    }

    // Verify activity exists
    const activity = await db.get('SELECT * FROM activities WHERE id = ?', [activity_id]);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Convert metrics to JSON string if it's an object
    const metricsString = typeof metrics === 'object' ? JSON.stringify(metrics) : metrics;

    const result = await db.run(`
      INSERT INTO logs (activity_id, text, metrics)
      VALUES (?, ?, ?)
    `, [activity_id, text, metricsString]);

    const newLog = await db.get(`
      SELECT l.*, a.name as activity_name 
      FROM logs l 
      JOIN activities a ON l.activity_id = a.id 
      WHERE l.id = ?
    `, [result.id]);
    
    res.status(201).json(newLog);
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({ error: 'Failed to create log' });
  }
});

// Update log
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, metrics } = req.body;

    // Check if log exists
    const existingLog = await db.get('SELECT * FROM logs WHERE id = ?', [id]);
    if (!existingLog) {
      return res.status(404).json({ error: 'Log not found' });
    }

    // Convert metrics to JSON string if it's an object
    const metricsString = typeof metrics === 'object' ? JSON.stringify(metrics) : metrics;

    await db.run(`
      UPDATE logs 
      SET text = ?, metrics = ?
      WHERE id = ?
    `, [text, metricsString, id]);

    const updatedLog = await db.get(`
      SELECT l.*, a.name as activity_name 
      FROM logs l 
      JOIN activities a ON l.activity_id = a.id 
      WHERE l.id = ?
    `, [id]);
    
    res.json(updatedLog);
  } catch (error) {
    console.error('Error updating log:', error);
    res.status(500).json({ error: 'Failed to update log' });
  }
});

// Delete log
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if log exists
    const existingLog = await db.get('SELECT * FROM logs WHERE id = ?', [id]);
    if (!existingLog) {
      return res.status(404).json({ error: 'Log not found' });
    }

    await db.run('DELETE FROM logs WHERE id = ?', [id]);
    
    res.json({ message: 'Log deleted successfully' });
  } catch (error) {
    console.error('Error deleting log:', error);
    res.status(500).json({ error: 'Failed to delete log' });
  }
});

// Get logs stats for an activity
router.get('/activity/:activity_id/stats', async (req, res) => {
  try {
    const { activity_id } = req.params;
    
    // Verify activity exists
    const activity = await db.get('SELECT * FROM activities WHERE id = ?', [activity_id]);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_logs,
        DATE(MIN(created_at)) as first_log_date,
        DATE(MAX(created_at)) as last_log_date,
        COUNT(DISTINCT DATE(created_at)) as days_logged
      FROM logs 
      WHERE activity_id = ?
    `, [activity_id]);

    // Get recent logs (last 10)
    const recentLogs = await db.all(`
      SELECT * FROM logs 
      WHERE activity_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [activity_id]);

    res.json({
      activity_name: activity.name,
      stats,
      recent_logs: recentLogs
    });
  } catch (error) {
    console.error('Error fetching log stats:', error);
    res.status(500).json({ error: 'Failed to fetch log stats' });
  }
});

export default router;