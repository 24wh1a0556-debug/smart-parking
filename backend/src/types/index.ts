export interface User {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  phone: string;
  role: 'USER' | 'ADMIN';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Vehicle {
  id: string;
  user_id: string;
  vehicle_number: string;
  vehicle_type: 'CAR' | 'BIKE' | 'TRUCK' | 'EV';
  vehicle_model: string;
  nickname?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ParkingSlot {
  id: string;
  slot_number: string;
  floor: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  vehicle_type: 'CAR' | 'BIKE' | 'TRUCK' | 'EV' | 'ANY';
  distance_from_entrance: number;
  section: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Reservation {
  id: string;
  booking_id: string;
  user_id: string;
  vehicle_id: string;
  slot_id: string;
  reservation_date: string;
  start_time: Date;
  expected_end_time: Date;
  actual_end_time?: Date;
  status: 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'OVERSTAY';
  estimated_fee: number;
  actual_fee?: number;
  qr_code?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ParkingSession {
  id: string;
  reservation_id: string;
  entry_time?: Date;
  exit_time?: Date;
  actual_duration_minutes?: number;
  final_fee?: number;
  fee_paid: boolean;
  payment_method: string;
  verified_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_id?: string;
  created_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Express.Request {
  user?: JwtPayload;
}
