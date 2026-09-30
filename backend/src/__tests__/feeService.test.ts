import { calculateFee } from '../services/feeService';

// Mock the database query for tests
jest.mock('../database/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  default: { query: jest.fn() },
}));

describe('Fee Calculation Service', () => {
  it('should charge first hour rate for 1 hour', async () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const end = new Date('2026-01-01T11:00:00Z');
    const result = await calculateFee('CAR', start, end);
    expect(result.durationHours).toBe(1);
    // Without DB, falls back to defaults: ₹20 for 1 hour
    expect(result.estimatedFee).toBe(20);
  });

  it('should charge correctly for 3 hours', async () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const end = new Date('2026-01-01T13:00:00Z');
    const result = await calculateFee('CAR', start, end);
    expect(result.durationHours).toBe(3);
    // ₹20 + 2 * ₹10 = ₹40
    expect(result.estimatedFee).toBe(40);
  });

  it('should charge first hour rate for partial first hour', async () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const end = new Date('2026-01-01T10:30:00Z');
    const result = await calculateFee('CAR', start, end);
    expect(result.durationHours).toBe(1);
    expect(result.estimatedFee).toBe(20);
  });
});

describe('Booking ID Generator', () => {
  it('should generate a booking ID starting with PK', async () => {
    const { generateBookingId } = await import('../services/feeService');
    const id = generateBookingId();
    expect(id).toMatch(/^PK\d+$/);
    expect(id.length).toBeGreaterThan(4);
  });
});
