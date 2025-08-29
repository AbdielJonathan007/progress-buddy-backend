import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ProgressBuddyDB {
  constructor() {
    this.db = null;
  }

  async init() {
    try {
      // Create data directory if it doesn't exist
      const dataDir = join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Use Railway's DATABASE_URL if available, otherwise local file
      const dbPath = process.env.DATABASE_URL || join(dataDir, 'progress_buddy.db');
      
      this.db = new Database(dbPath);
      console.log('✅ Connected to SQLite database');
      
      await this.createTables();
      return true;
    } catch (error) {
      console.error('Error opening database:', error);
      throw error;
    }
  }

  async createTables() {
    try {
      const activitiesTable = `
        CREATE TABLE IF NOT EXISTS activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          specific TEXT NOT NULL,
          measurable TEXT NOT NULL,
          achievable TEXT,
          relevant TEXT,
          timebound TEXT NOT NULL,
          buddy_email TEXT,
          completed BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const logsTable = `
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id INTEGER NOT NULL,
          text TEXT NOT NULL,
          metrics TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE
        )
      `;

      const goalsTable = `
        CREATE TABLE IF NOT EXISTS goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id INTEGER NOT NULL,
          target_value INTEGER NOT NULL,
          current_value INTEGER DEFAULT 0,
          target_date DATE,
          achieved BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE
        )
      `;

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      // Create tables
      this.db.exec(activitiesTable);
      this.db.exec(logsTable);
      this.db.exec(goalsTable);
      
      console.log('✅ Database tables created/verified');
      return true;
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  // Generic query methods
  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params);
    } catch (error) {
      console.error('Error in get query:', error);
      throw error;
    }
  }

  all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error('Error in all query:', error);
      throw error;
    }
  }

  run(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return { id: result.lastInsertRowid, changes: result.changes };
    } catch (error) {
      console.error('Error in run query:', error);
      throw error;
    }
  }

  // Transaction support
  transaction(callback) {
    try {
      this.db.exec('BEGIN TRANSACTION');
      const result = callback();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    try {
      if (this.db) {
        this.db.close();
        console.log('✅ Database connection closed');
      }
    } catch (error) {
      console.error('Error closing database:', error);
      throw error;
    }
  }

  // Activity-specific methods
  async getAllActivities() {
    return this.all('SELECT * FROM activities ORDER BY created_at DESC');
  }

  async createActivity(activity) {
    const sql = `
      INSERT INTO activities (name, description, specific, measurable, achievable, relevant, timebound, buddy_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      activity.name,
      activity.description,
      activity.specific,
      activity.measurable,
      activity.achievable,
      activity.relevant,
      activity.timebound,
      activity.buddy_email
    ];
    return this.run(sql, params);
  }

  async updateActivity(id, activity) {
    const sql = `
      UPDATE activities 
      SET name = ?, description = ?, specific = ?, measurable = ?, achievable = ?, relevant = ?, timebound = ?, buddy_email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const params = [
      activity.name,
      activity.description,
      activity.specific,
      activity.measurable,
      activity.achievable,
      activity.relevant,
      activity.timebound,
      activity.buddy_email,
      id
    ];
    return this.run(sql, params);
  }

  async deleteActivity(id) {
    return this.run('DELETE FROM activities WHERE id = ?', [id]);
  }

  // Log-specific methods
  async getLogsByActivity(activityId) {
    return this.all('SELECT * FROM logs WHERE activity_id = ? ORDER BY created_at DESC', [activityId]);
  }

  async createLog(log) {
    const sql = 'INSERT INTO logs (activity_id, text, metrics) VALUES (?, ?, ?)';
    return this.run(sql, [log.activity_id, log.text, log.metrics]);
  }

  // Goal-specific methods
  async getGoalsByActivity(activityId) {
    return this.all('SELECT * FROM goals WHERE activity_id = ? ORDER BY created_at DESC', [activityId]);
  }

  async createGoal(goal) {
    const sql = 'INSERT INTO goals (activity_id, target_value, target_date) VALUES (?, ?, ?)';
    return this.run(sql, [goal.activity_id, goal.target_value, goal.target_date]);
  }

  async updateGoalProgress(goalId, currentValue) {
    const sql = 'UPDATE goals SET current_value = ?, achieved = ? WHERE id = ?';
    const achieved = currentValue >= this.get('SELECT target_value FROM goals WHERE id = ?', [goalId]).target_value;
    return this.run(sql, [currentValue, achieved ? 1 : 0, goalId]);
  }
}