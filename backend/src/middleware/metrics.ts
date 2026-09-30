import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Enable default metrics (CPU, memory, etc.)
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestCount = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register],
});

export const httpErrorCount = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const activeRequests = new client.Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests',
  registers: [register],
});

// Parking-specific metrics
export const availableSlotsGauge = new client.Gauge({
  name: 'parking_available_slots',
  help: 'Number of available parking slots',
  registers: [register],
});

export const occupiedSlotsGauge = new client.Gauge({
  name: 'parking_occupied_slots',
  help: 'Number of occupied parking slots',
  registers: [register],
});

export const activeReservationsGauge = new client.Gauge({
  name: 'parking_active_reservations',
  help: 'Number of active reservations',
  registers: [register],
});

export const completedSessionsCounter = new client.Counter({
  name: 'parking_completed_sessions_total',
  help: 'Total number of completed parking sessions',
  registers: [register],
});

// Metrics middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  activeRequests.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    };

    httpRequestCount.inc(labels);
    httpRequestDuration.observe(labels, duration);
    activeRequests.dec();

    if (res.statusCode >= 400) {
      httpErrorCount.inc(labels);
    }
  });

  next();
};

export const getMetrics = async (req: Request, res: Response): Promise<void> => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

export default register;
