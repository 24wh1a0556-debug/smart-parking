import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pool from './database/db';
import { errorHandler, notFound } from './middleware/errorHandler';
import { metricsMiddleware, getMetrics } from './middleware/metrics';
import authRoutes from './routes/auth';
import parkingRoutes from './routes/parking';
import vehicleRoutes from './routes/vehicles';
import reservationRoutes from './routes/reservations';
import entryExitRoutes from './routes/entryExit';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';
import locationsRouter from './routes/locations';
import { startOverstayCron } from './services/cronJobs';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Metrics middleware (before routes)
app.use(metricsMiddleware);

// Health check endpoint (no auth required)
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', getMetrics);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/parking', parkingRoutes);
app.use('/api/parking', entryExitRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
// Smart Parking locations, recommendations, predictions, user preferences, AI chat
app.use('/api', locationsRouter);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Smart Parking API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  
  // Start background jobs
  startOverstayCron();
});

export default app;
