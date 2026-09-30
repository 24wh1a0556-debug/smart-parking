import { query } from '../database/db';

export interface FeeCalculationResult {
  estimatedFee: number;
  durationHours: number;
  breakdown: string;
}

export const calculateFee = async (
  vehicleType: string,
  startTime: Date,
  endTime: Date
): Promise<FeeCalculationResult> => {
  // Get pricing config from DB
  const pricingResult = await query(
    `SELECT first_hour_rate, additional_hour_rate, daily_max_rate 
     FROM pricing_config 
     WHERE vehicle_type = $1 AND is_active = true 
     LIMIT 1`,
    [vehicleType.toUpperCase()]
  );

  let firstHourRate = 20;
  let additionalHourRate = 10;
  let dailyMaxRate = 200;

  if (pricingResult.rows.length > 0) {
    firstHourRate = parseFloat(pricingResult.rows[0].first_hour_rate);
    additionalHourRate = parseFloat(pricingResult.rows[0].additional_hour_rate);
    dailyMaxRate = parseFloat(pricingResult.rows[0].daily_max_rate);
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));

  let fee = 0;
  let breakdown = '';

  if (durationHours <= 0) {
    fee = 0;
    breakdown = 'No charge';
  } else if (durationHours === 1) {
    fee = firstHourRate;
    breakdown = `1 hour × ₹${firstHourRate}`;
  } else {
    fee = firstHourRate + (durationHours - 1) * additionalHourRate;
    breakdown = `1st hour ₹${firstHourRate} + ${durationHours - 1} hour(s) × ₹${additionalHourRate}`;
  }

  // Apply daily maximum
  fee = Math.min(fee, dailyMaxRate);

  return {
    estimatedFee: Math.round(fee * 100) / 100,
    durationHours,
    breakdown,
  };
};

export const generateBookingId = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `PK${timestamp}${random}`;
};
