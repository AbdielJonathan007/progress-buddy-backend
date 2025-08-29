import express from 'express';

const router = express.Router();

// Database instance will be injected
let db;

export function setDatabase(databaseInstance) {
  db = databaseInstance;
}

// Get all activities
router.get('/', async (req, res) => {
  try {
    const activities = await db.all('SELECT * FROM activities ORDER BY created_at DESC');
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get single activity by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await db.get('SELECT * FROM activities WHERE id = ?', [id]);
    
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    // Also get associated logs
    const logs = await db.all('SELECT * FROM logs WHERE activity_id = ? ORDER BY created_at DESC', [id]);
    
    res.json({ ...activity, logs });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Create new activity
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      specific,
      measurable,
      achievable,
      relevant,
      timebound,
      buddy_email
    } = req.body;

    // Validate required fields
    if (!name || !specific || !measurable || !timebound) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, specific, measurable, timebound' 
      });
    }

    const result = await db.run(`
      INSERT INTO activities (name, description, specific, measurable, achievable, relevant, timebound, buddy_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, description, specific, measurable, achievable, relevant, timebound, buddy_email]);

    const newActivity = await db.get('SELECT * FROM activities WHERE id = ?', [result.id]);
    
    res.status(201).json(newActivity);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// Update activity
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      specific,
      measurable,
      achievable,
      relevant,
      timebound,
      buddy_email,
      completed
    } = req.body;

    // Check if activity exists
    const existingActivity = await db.get('SELECT * FROM activities WHERE id = ?', [id]);
    if (!existingActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await db.run(`
      UPDATE activities 
      SET name = ?, description = ?, specific = ?, measurable = ?, achievable = ?, 
          relevant = ?, timebound = ?, buddy_email = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description, specific, measurable, achievable, relevant, timebound, buddy_email, completed, id]);

    const updatedActivity = await db.get('SELECT * FROM activities WHERE id = ?', [id]);
    
    res.json(updatedActivity);
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Delete activity
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if activity exists
    const existingActivity = await db.get('SELECT * FROM activities WHERE id = ?', [id]);
    if (!existingActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await db.run('DELETE FROM activities WHERE id = ?', [id]);
    
    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

// Mark activity as completed
router.patch('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if activity exists
    const existingActivity = await db.get('SELECT * FROM activities WHERE id = ?', [id]);
    if (!existingActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await db.run('UPDATE activities SET completed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    
    const updatedActivity = await db.get('SELECT * FROM activities WHERE id = ?', [id]);
    
    res.json(updatedActivity);
  } catch (error) {
    console.error('Error completing activity:', error);
    res.status(500).json({ error: 'Failed to complete activity' });
  }
});

export default router;