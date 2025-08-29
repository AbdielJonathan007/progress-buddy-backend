import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ProgressBuddyDB } from './database.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
const db = new ProgressBuddyDB(); // ← Changed here

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', // Local development
    'https://main.d1whszx96wcifr.amplifyapp.com', // Your Amplify domain
    'https://*.amplifyapp.com', // All Amplify domains
    'https://*.railway.app', // Allow Railway domains
    'https://*.up.railway.app' // Railway deployment domain
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
    // Note: You might need to update your route files to handle the new database methods
    activitiesModule.setDatabase(db);
    logsModule.setDatabase(db);
    notificationsModule.setDatabase(db);
    
    app.use('/api/activities', activitiesModule.default);
    app.use('/api/logs', logsModule.default);
    app.use('/api/notifications', notificationsModule.default);
    
    console.log('✅ Routes initialized successfully');
    
    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'OK', 
        message: 'Progress Buddy API is running',
        timestamp: new Date().toISOString()
      });
    });

    // Test endpoint to verify database connection
    app.get('/api/test-db', async (req, res) => {
      try {
        const result = await db.get('SELECT 1 as test');
        res.json({ database: 'connected', test: result });
      } catch (error) {
        res.status(500).json({ database: 'error', error: error.message });
      }
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Server error:', err.stack);
      res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
      });
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl 
      });
    });
    
    app.listen(PORT, () => {
      console.log(`🚀 Progress Buddy API server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server gracefully...');
  try {
    await db.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

startServer();

export { db };