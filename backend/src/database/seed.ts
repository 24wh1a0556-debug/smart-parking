import bcrypt from 'bcryptjs';
import pool from './db';
import dotenv from 'dotenv';

dotenv.config();

const seed = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🌱 Seeding database...');

    // ---- Pricing Config ----
    await client.query(`
      INSERT INTO pricing_config (vehicle_type, first_hour_rate, additional_hour_rate, daily_max_rate)
      VALUES 
        ('CAR', 20.00, 10.00, 200.00),
        ('BIKE', 10.00, 5.00, 100.00),
        ('TRUCK', 40.00, 20.00, 400.00),
        ('EV', 15.00, 8.00, 150.00)
      ON CONFLICT DO NOTHING
    `);

    // ---- Admin User ----
    const adminHash = await bcrypt.hash('Admin@123', 12);
    const adminResult = await client.query(`
      INSERT INTO users (full_name, email, password_hash, phone, role)
      VALUES ('Admin User', 'admin@smartparking.com', $1, '9999000001', 'ADMIN')
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id
    `, [adminHash]);

    const adminId = adminResult.rows[0].id;

    // ---- Regular Users ----
    const user1Hash = await bcrypt.hash('User@123', 12);
    const user1Result = await client.query(`
      INSERT INTO users (full_name, email, password_hash, phone, role)
      VALUES ('Rahul Sharma', 'rahul@example.com', $1, '9876543210', 'USER')
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id
    `, [user1Hash]);

    const user1Id = user1Result.rows[0].id;

    const user2Hash = await bcrypt.hash('User@123', 12);
    const user2Result = await client.query(`
      INSERT INTO users (full_name, email, password_hash, phone, role)
      VALUES ('Priya Patel', 'priya@example.com', $1, '9876543211', 'USER')
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id
    `, [user2Hash]);

    const user2Id = user2Result.rows[0].id;

    const user3Hash = await bcrypt.hash('User@123', 12);
    const user3Result = await client.query(`
      INSERT INTO users (full_name, email, password_hash, phone, role)
      VALUES ('Amit Kumar', 'amit@example.com', $1, '9876543212', 'USER')
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id
    `, [user3Hash]);

    const user3Id = user3Result.rows[0].id;

    // ---- Vehicles ----
    const v1Result = await client.query(`
      INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, vehicle_model, nickname)
      VALUES ($1, 'TS09AB1234', 'CAR', 'Honda City', 'My Honda')
      ON CONFLICT (vehicle_number) DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING id
    `, [user1Id]);

    const v2Result = await client.query(`
      INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, vehicle_model, nickname)
      VALUES ($1, 'TS09CD5678', 'BIKE', 'Royal Enfield', 'Bullet')
      ON CONFLICT (vehicle_number) DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING id
    `, [user1Id]);

    const v3Result = await client.query(`
      INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, vehicle_model, nickname)
      VALUES ($1, 'AP10EF9012', 'CAR', 'Maruti Swift', 'Swift')
      ON CONFLICT (vehicle_number) DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING id
    `, [user2Id]);

    const v4Result = await client.query(`
      INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, vehicle_model, nickname)
      VALUES ($1, 'KA05GH3456', 'EV', 'Tata Nexon EV', 'EV Car')
      ON CONFLICT (vehicle_number) DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING id
    `, [user3Id]);

    // ---- Parking Slots ----
    const slots = [];
    const sections = ['A', 'B', 'C', 'D'];
    const floors = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor'];
    const vehicleTypes = ['CAR', 'CAR', 'CAR', 'BIKE', 'CAR', 'CAR', 'TRUCK', 'EV', 'CAR', 'CAR'];

    let distance = 20;

    for (let s = 0; s < sections.length; s++) {
      for (let i = 1; i <= 10; i++) {
        const slotNumber = `${sections[s]}${i}`;
        const floor = floors[s];
        const vehicleType = vehicleTypes[(i - 1) % vehicleTypes.length];

        const status = (s === 0 && i <= 3) ? 'OCCUPIED' :
                       (s === 0 && i === 4) ? 'RESERVED' :
                       (s === 3 && i > 8) ? 'MAINTENANCE' : 'AVAILABLE';

        slots.push([
          slotNumber,
          floor,
          status,
          vehicleType,
          distance + (s * 60) + (i * 20),
          sections[s]
        ]);
      }
    }

    for (const slot of slots) {
      await client.query(`
        INSERT INTO parking_slots (slot_number, floor, status, vehicle_type, distance_from_entrance, section)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slot_number) DO UPDATE SET status = EXCLUDED.status
      `, slot as any[]);
    }

    // ---- Get some slot IDs for reservations ----
    const slotsResult = await client.query(
      `SELECT id, slot_number FROM parking_slots ORDER BY slot_number`
    );

    const slotMap: Record<string, string> = {};

    slotsResult.rows.forEach((r: { slot_number: string; id: string }) => {
      slotMap[r.slot_number] = r.id;
    });

    // ---- Reservations and Sessions ----
    const now = new Date();

    // Completed reservation 1 (yesterday)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const yStart = new Date(yesterday);
    yStart.setHours(10, 0, 0, 0);

    const yEnd = new Date(yesterday);
    yEnd.setHours(13, 0, 0, 0);

    const res1Result = await client.query(`
      INSERT INTO reservations (
        booking_id,
        user_id,
        vehicle_id,
        slot_id,
        reservation_date,
        start_time,
        expected_end_time,
        actual_end_time,
        status,
        estimated_fee,
        actual_fee
      )
      VALUES ('PK1001', $1, $2, $3, $4, $5, $6, $6, 'COMPLETED', 40.00, 40.00)
      ON CONFLICT (booking_id) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `, [
      user1Id,
      v1Result.rows[0].id,
      slotMap['A5'],
      yesterday.toISOString().split('T')[0],
      yStart,
      yEnd
    ]);

    if (res1Result.rows.length > 0) {
      await client.query(`
        INSERT INTO parking_sessions (
          reservation_id,
          entry_time,
          exit_time,
          actual_duration_minutes,
          final_fee,
          fee_paid
        )
        VALUES ($1, $2, $3, 180, 40.00, true)
        ON CONFLICT DO NOTHING
      `, [res1Result.rows[0].id, yStart, yEnd]);
    }

    // Completed reservation 2
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const t2Start = new Date(twoDaysAgo);
    t2Start.setHours(9, 0, 0, 0);

    const t2End = new Date(twoDaysAgo);
    t2End.setHours(12, 30, 0, 0);

    const res2Result = await client.query(`
      INSERT INTO reservations (
        booking_id,
        user_id,
        vehicle_id,
        slot_id,
        reservation_date,
        start_time,
        expected_end_time,
        actual_end_time,
        status,
        estimated_fee,
        actual_fee
      )
      VALUES ('PK1002', $1, $2, $3, $4, $5, $6, $6, 'COMPLETED', 35.00, 35.00)
      ON CONFLICT (booking_id) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `, [
      user2Id,
      v3Result.rows[0].id,
      slotMap['B3'],
      twoDaysAgo.toISOString().split('T')[0],
      t2Start,
      t2End
    ]);

    if (res2Result.rows.length > 0) {
      await client.query(`
        INSERT INTO parking_sessions (
          reservation_id,
          entry_time,
          exit_time,
          actual_duration_minutes,
          final_fee,
          fee_paid
        )
        VALUES ($1, $2, $3, 210, 35.00, true)
        ON CONFLICT DO NOTHING
      `, [res2Result.rows[0].id, t2Start, t2End]);
    }

    // Active reservation today
    const todayStart = new Date(now);
    todayStart.setHours(9, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(12, 0, 0, 0);

    await client.query(`
      INSERT INTO reservations (
        booking_id,
        user_id,
        vehicle_id,
        slot_id,
        reservation_date,
        start_time,
        expected_end_time,
        status,
        estimated_fee,
        qr_code
      )
      VALUES ('PK1003', $1, $2, $3, $4, $5, $6, 'ACTIVE', 30.00, 'QR_PK1003')
      ON CONFLICT (booking_id) DO UPDATE SET status = EXCLUDED.status
    `, [
      user1Id,
      v1Result.rows[0].id,
      slotMap['A1'],
      now.toISOString().split('T')[0],
      todayStart,
      todayEnd
    ]);

    // Future reservation
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tmStart = new Date(tomorrow);
    tmStart.setHours(10, 0, 0, 0);

    const tmEnd = new Date(tomorrow);
    tmEnd.setHours(14, 0, 0, 0);

    await client.query(`
      INSERT INTO reservations (
        booking_id,
        user_id,
        vehicle_id,
        slot_id,
        reservation_date,
        start_time,
        expected_end_time,
        status,
        estimated_fee,
        qr_code
      )
      VALUES ('PK1004', $1, $2, $3, $4, $5, $6, 'CONFIRMED', 50.00, 'QR_PK1004')
      ON CONFLICT (booking_id) DO UPDATE SET status = EXCLUDED.status
    `, [
      user3Id,
      v4Result.rows[0].id,
      slotMap['A4'],
      tomorrow.toISOString().split('T')[0],
      tmStart,
      tmEnd
    ]);

    // More historical data for analytics
    for (let day = 3; day <= 30; day++) {
      const pastDate = new Date(now);
      pastDate.setDate(pastDate.getDate() - day);

      // 3-8 reservations per day for realistic data
      const numRes = Math.floor(Math.random() * 6) + 3;

      for (let r = 0; r < numRes; r++) {
        const startHour = Math.floor(Math.random() * 10) + 8;
        const duration = Math.floor(Math.random() * 4) + 1;

        const rStart = new Date(pastDate);
        rStart.setHours(startHour, 0, 0, 0);

        const rEnd = new Date(rStart);
        rEnd.setHours(rStart.getHours() + duration, 0, 0, 0);

        const fee = duration === 1 ? 20 : 20 + (duration - 1) * 10;

        const bookingId = `PK${2000 + day * 10 + r}`;

        const slotKeys = Object.keys(slotMap);
        const slotKey = slotKeys[Math.floor(Math.random() * slotKeys.length)];

        const users = [user1Id, user2Id, user3Id];
        const randUser = users[Math.floor(Math.random() * users.length)];

        const vehicles = [
          v1Result.rows[0].id,
          v3Result.rows[0].id,
          v4Result.rows[0].id
        ];

        const randVehicle = vehicles[Math.floor(Math.random() * vehicles.length)];

        const resResult = await client.query(`
          INSERT INTO reservations (
            booking_id,
            user_id,
            vehicle_id,
            slot_id,
            reservation_date,
            start_time,
            expected_end_time,
            actual_end_time,
            status,
            estimated_fee,
            actual_fee
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 'COMPLETED', $8, $8)
          ON CONFLICT (booking_id) DO NOTHING
          RETURNING id
        `, [
          bookingId,
          randUser,
          randVehicle,
          slotMap[slotKey],
          pastDate.toISOString().split('T')[0],
          rStart,
          rEnd,
          fee
        ]);

        if (resResult.rows.length > 0) {
          await client.query(`
            INSERT INTO parking_sessions (
              reservation_id,
              entry_time,
              exit_time,
              actual_duration_minutes,
              final_fee,
              fee_paid
            )
            VALUES ($1, $2, $3, $4, $5, true)
            ON CONFLICT DO NOTHING
          `, [
            resResult.rows[0].id,
            rStart,
            rEnd,
            duration * 60,
            fee
          ]);
        }
      }
    }

    // ---- Notifications ----
    await client.query(`
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        is_read
      )
      VALUES 
        ($1, 'RESERVATION_CONFIRMED', 'Reservation Confirmed', 'Your reservation PK1003 for slot A1 has been confirmed.', false),
        ($1, 'PARKING_REMINDER', 'Parking Reminder', 'Your parking session for slot A1 is active.', false),
        ($2, 'RESERVATION_CONFIRMED', 'Reservation Confirmed', 'Your reservation PK1004 for slot A4 has been confirmed.', false)
    `, [user1Id, user3Id]);

    await client.query('COMMIT');

    console.log('✅ Seed data inserted successfully');
    console.log('\n📋 Demo Credentials:');
    console.log('  Admin: admin@smartparking.com / Admin@123');
    console.log('  User 1: rahul@example.com / User@123');
    console.log('  User 2: priya@example.com / User@123');
    console.log('  User 3: amit@example.com / User@123');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding:', err);
    throw err;

  } finally {
    client.release();
  }
};

seed()
  .then(() => {
    console.log('\nSeeding completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });