import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Database } from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
const db = new Database();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', // Local development
    'https://main.d1whszx96wcifr.amplifyapp.com', // Your Amplify domain
    'https://*.amplifyapp.com' // All Amplify domains (optional)
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database and routes
async function startServer() {
  try {
    await db.init();
    console.log('✅ Database initialized successfully');
    
    // Import and set up routes after database is ready
    const activitiesModule = await import('./routes/activities.js');
    const logsModule = await import('./routes/logs.js');
    const notificationsModule = await import('./routes/notifications.js');
    
    // Inject database instance into each route module
    activitiesModule.setDatabase(db);
    logsModule.setDatabase(db);
    notificationsModule.setDatabase(db);
    
    app.use('/api/activities', activitiesModule.default);
    app.use('/api/logs', logsModule.default);
    app.use('/api/notifications', notificationsModule.default);
    
    console.log('✅ Routes initialized successfully');
    
    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({ status: 'OK', message: 'Progress Buddy API is running' });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
      });
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
    
    app.listen(PORT, () => {
      console.log(`🚀 Progress Buddy API server running on port ${PORT}`);
      console.log(`📊 Health check: http://port${PORT}/api/health`);
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    process.exit(1);
  }
}

startServer();

export { db };
