import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate latitude/longitude values.
 * Returns a string error message, or null if valid.
 */
function validateLatLng(
  lat: unknown,
  lng: unknown,
): string | null {
  if (lat === undefined || lat === null || lat === '') return 'lat is required';
  if (lng === undefined || lng === null || lng === '') return 'lng is required';

  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);

  if (isNaN(latNum)) return 'lat must be a valid number';
  if (isNaN(lngNum)) return 'lng must be a valid number';
  if (latNum < -90 || latNum > 90) return 'lat must be between -90 and 90';
  if (lngNum < -180 || lngNum > 180) return 'lng must be between -180 and 180';

  return null;
}

/**
 * SQL fragment that computes available_slots for a parking_location row aliased as `pl`.
 * - If parking_slots rows exist for this location: use total_slots minus occupied/reserved count.
 * - Otherwise (seeded locations without individual slot rows): return total_slots directly.
 */
const AVAILABLE_SLOTS_SQL = `
  CASE
    WHEN (SELECT COUNT(*) FROM parking_slots ps2 WHERE ps2.location_id = pl.id) > 0 THEN
      GREATEST(0, pl.total_slots - (
        SELECT COUNT(*) FROM parking_slots ps3
        WHERE ps3.location_id = pl.id
          AND ps3.status IN ('OCCUPIED', 'RESERVED')
      ))
    ELSE
      pl.total_slots
  END
`;

/**
 * SQL fragment for occupied_slots (always from slot rows, 0 if no slot rows).
 */
const OCCUPIED_SLOTS_SQL = `
  (SELECT COUNT(*) FROM parking_slots ps4
   WHERE ps4.location_id = pl.id AND ps4.status = 'OCCUPIED')
`;

/**
 * Haversine distance formula in SQL (returns km).
 * $1 = user_lat, $2 = user_lng  — caller must pass them in the right param positions.
 */
function haversineSQL(latParam: string, lngParam: string): string {
  return `
    6371 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(${latParam})) * cos(radians(pl.lat))
          * cos(radians(pl.lng) - radians(${lngParam}))
        + sin(radians(${latParam})) * sin(radians(pl.lat))
      ))
    )
  `.trim();
}

/**
 * Core SELECT block reused by /nearby, /search, /recommendations.
 * Caller provides the $lat and $lng param placeholders so they can position
 * them anywhere in the param array.
 */
function coreSelectSQL(latParam: string, lngParam: string): string {
  return `
    pl.id,
    pl.name,
    pl.address,
    pl.lat,
    pl.lng,
    ROUND(CAST(${haversineSQL(latParam, lngParam)} AS numeric), 2) AS distance_km,
    pl.price_per_hour,
    pl.total_slots,
    (${AVAILABLE_SLOTS_SQL})::int                           AS available_slots,
    (${OCCUPIED_SLOTS_SQL})::int                            AS occupied_slots,
    CASE
      WHEN pl.total_slots > 0
        THEN ROUND(CAST((${OCCUPIED_SLOTS_SQL}) * 100.0 / pl.total_slots AS numeric), 1)
      ELSE 0
    END                                                     AS occupancy_pct,
    pl.is_open,
    pl.has_covered,
    pl.has_ev_charging,
    pl.has_security,
    pl.has_cctv,
    pl.is_accessible,
    pl.opening_time,
    pl.closing_time,
    -- EV charging info as JSON (null if none)
    (SELECT row_to_json(ev)
     FROM (
       SELECT total_chargers, available_chargers, charger_type,
              charge_rate_kw, price_per_kwh
       FROM ev_charging_info eci
       WHERE eci.location_id = pl.id
       LIMIT 1
     ) ev
    ) AS ev_charging
  `.trim();
}

interface LocationRow {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km: number;
  price_per_hour: number;
  total_slots: number;
  available_slots: number;
  occupied_slots: number;
  occupancy_pct: number;
  is_open: boolean;
  has_covered: boolean;
  has_ev_charging: boolean;
  has_security: boolean;
  has_cctv: boolean;
  is_accessible: boolean;
  opening_time: string;
  closing_time: string;
  ev_charging: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// GET /api/parking/nearby
// ---------------------------------------------------------------------------
router.get(
  '/parking/nearby',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { lat, lng, radius, vehicle_type, has_ev, has_covered } = req.query;

    const validationError = validateLatLng(lat, lng);
    if (validationError) throw new AppError(validationError, 400);

    const userLat = parseFloat(lat as string);
    const userLng = parseFloat(lng as string);
    const radiusKm = radius ? parseFloat(radius as string) : 10;

    if (isNaN(radiusKm) || radiusKm <= 0) {
      throw new AppError('radius must be a positive number', 400);
    }

    const params: unknown[] = [userLat, userLng, radiusKm];
    let paramIdx = 4; // next available param index

    let whereExtra = '';

    if (has_ev === 'true') {
      whereExtra += ` AND pl.has_ev_charging = true`;
    }
    if (has_covered === 'true') {
      whereExtra += ` AND pl.has_covered = true`;
    }
    if (vehicle_type) {
      // parking_slots vehicle_type check — filter locations that have matching slot types
      whereExtra += ` AND (
        EXISTS (
          SELECT 1 FROM parking_slots ps_vt
          WHERE ps_vt.location_id = pl.id
            AND (ps_vt.vehicle_type = $${paramIdx} OR ps_vt.vehicle_type = 'ANY')
        )
        OR NOT EXISTS (
          SELECT 1 FROM parking_slots ps_any WHERE ps_any.location_id = pl.id
        )
      )`;
      params.push(vehicle_type);
      paramIdx++;
    }

    const sql = `
      SELECT ${coreSelectSQL('$1', '$2')}
      FROM parking_locations pl
      WHERE pl.is_active = true
        AND ${haversineSQL('$1', '$2')} <= $3
        ${whereExtra}
      ORDER BY distance_km ASC
    `;

    const result = await query(sql, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/parking/search
// ---------------------------------------------------------------------------
router.get(
  '/parking/search',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { q, lat, lng } = req.query;

    if (!q || (q as string).trim() === '') {
      throw new AppError('q (search text) is required', 400);
    }

    const hasCoords = lat !== undefined && lng !== undefined;
    if (hasCoords) {
      const err = validateLatLng(lat, lng);
      if (err) throw new AppError(err, 400);
    }

    const searchTerm = `%${(q as string).trim()}%`;

    if (hasCoords) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);

      const sql = `
        SELECT ${coreSelectSQL('$1', '$2')}
        FROM parking_locations pl
        WHERE pl.is_active = true
          AND (pl.name ILIKE $3 OR pl.address ILIKE $3)
        ORDER BY distance_km ASC
      `;

      const result = await query(sql, [userLat, userLng, searchTerm]);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } else {
      // No coordinates — still return location data but distance_km will be null
      const sql = `
        SELECT
          pl.id,
          pl.name,
          pl.address,
          pl.lat,
          pl.lng,
          NULL::numeric                                        AS distance_km,
          pl.price_per_hour,
          pl.total_slots,
          (${AVAILABLE_SLOTS_SQL})::int                       AS available_slots,
          (${OCCUPIED_SLOTS_SQL})::int                        AS occupied_slots,
          CASE
            WHEN pl.total_slots > 0
              THEN ROUND(CAST((${OCCUPIED_SLOTS_SQL}) * 100.0 / pl.total_slots AS numeric), 1)
            ELSE 0
          END                                                  AS occupancy_pct,
          pl.is_open,
          pl.has_covered,
          pl.has_ev_charging,
          pl.has_security,
          pl.has_cctv,
          pl.is_accessible,
          pl.opening_time,
          pl.closing_time,
          (SELECT row_to_json(ev)
           FROM (
             SELECT total_chargers, available_chargers, charger_type,
                    charge_rate_kw, price_per_kwh
             FROM ev_charging_info eci
             WHERE eci.location_id = pl.id
             LIMIT 1
           ) ev
          ) AS ev_charging
        FROM parking_locations pl
        WHERE pl.is_active = true
          AND (pl.name ILIKE $1 OR pl.address ILIKE $1)
        ORDER BY pl.name ASC
      `;

      const result = await query(sql, [searchTerm]);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    }
  }),
);

// ---------------------------------------------------------------------------
// GET /api/parking/recommendations
// ---------------------------------------------------------------------------
router.get(
  '/parking/recommendations',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { lat, lng, vehicle_type } = req.query;
    let { preference_mode } = req.query;

    const validationError = validateLatLng(lat, lng);
    if (validationError) throw new AppError(validationError, 400);

    const userLat = parseFloat(lat as string);
    const userLng = parseFloat(lng as string);

    // If no preference_mode in query, check user's saved preference
    if (!preference_mode) {
      const prefResult = await query(
        `SELECT preference_mode FROM user_preferences WHERE user_id = $1`,
        [req.user!.userId],
      );
      if (prefResult.rows.length > 0) {
        preference_mode = prefResult.rows[0].preference_mode as string;
      } else {
        preference_mode = 'balanced';
      }
    }

    const validModes = ['cheapest', 'nearest', 'most_available', 'ev_charging', 'covered', 'balanced'];
    if (!validModes.includes(preference_mode as string)) {
      throw new AppError(
        `preference_mode must be one of: ${validModes.join(', ')}`,
        400,
      );
    }

    const params: unknown[] = [userLat, userLng];
    let paramIdx = 3;

    let evFilter = '';
    if (preference_mode === 'ev_charging') {
      evFilter = ' AND pl.has_ev_charging = true';
    }

    let vehicleFilter = '';
    if (vehicle_type) {
      vehicleFilter = ` AND (
        EXISTS (
          SELECT 1 FROM parking_slots ps_vt
          WHERE ps_vt.location_id = pl.id
            AND (ps_vt.vehicle_type = $${paramIdx} OR ps_vt.vehicle_type = 'ANY')
        )
        OR NOT EXISTS (
          SELECT 1 FROM parking_slots ps_any WHERE ps_any.location_id = pl.id
        )
      )`;
      params.push(vehicle_type);
      paramIdx++;
    }

    const sql = `
      SELECT ${coreSelectSQL('$1', '$2')}
      FROM parking_locations pl
      WHERE pl.is_active = true
        ${evFilter}
        ${vehicleFilter}
    `;

    const result = await query(sql, params);
    const locations = result.rows as LocationRow[];

    if (locations.length === 0) {
      res.json({ success: true, count: 0, data: [] });
      return;
    }

    // Score each location
    const mode = preference_mode as string;

    const scored = locations.map((loc) => {
      const distKm = Number(loc.distance_km) || 0;
      const availSlots = Number(loc.available_slots) || 0;
      const totalSlots = Number(loc.total_slots) || 1;
      const pricePerHour = Number(loc.price_per_hour) || 0;

      let distance_score = Math.max(0, 1 - distKm / 10) * 30;
      let availability_score = (availSlots / totalSlots) * 25;
      let price_score = Math.max(0, 1 - pricePerHour / 100) * 20;
      const openness_score = loc.is_open ? 15 : 0;
      let features_score =
        (loc.has_security ? 3 : 0) +
        (loc.has_cctv ? 2 : 0) +
        (loc.has_ev_charging ? 3 : 0) +
        (loc.has_covered ? 2 : 0);

      // Apply preference multipliers
      switch (mode) {
        case 'cheapest':
          price_score *= 2;
          break;
        case 'nearest':
          distance_score *= 2;
          break;
        case 'most_available':
          availability_score *= 2;
          break;
        case 'covered':
          if (loc.has_covered) features_score *= 2;
          break;
        // ev_charging and balanced: no multiplier changes
      }

      const total_score =
        distance_score + availability_score + price_score + openness_score + features_score;

      const availPct = Math.round((availSlots / totalSlots) * 100);
      const reason_text =
        `Recommended because it is ${distKm.toFixed(1)} km away, ` +
        `has ${availPct}% availability, and costs ₹${pricePerHour}/hour.`;

      return {
        ...loc,
        score: Math.round(total_score * 10) / 10,
        reason_text,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      preference_mode: mode,
      count: scored.length,
      data: scored,
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/parking/predictions
// ---------------------------------------------------------------------------
router.get(
  '/parking/predictions',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { location_id, hours_ahead } = req.query;

    if (!location_id) throw new AppError('location_id is required', 400);

    const hoursAheadNum = hours_ahead ? parseInt(hours_ahead as string, 10) : 3;
    if (isNaN(hoursAheadNum) || hoursAheadNum < 1 || hoursAheadNum > 24) {
      throw new AppError('hours_ahead must be between 1 and 24', 400);
    }

    // Verify location exists
    const locCheck = await query(
      `SELECT id FROM parking_locations WHERE id = $1 AND is_active = true`,
      [location_id],
    );
    if (locCheck.rows.length === 0) throw new AppError('Parking location not found', 404);

    // Current time info
    const now = new Date();
    const currentHour = now.getHours();
    // day_of_week: 0=Sunday … 6=Saturday (matching JS Date.getDay())
    const currentDayOfWeek = now.getDay();

    const predictions: {
      hour: number;
      hour_label: string;
      predicted_pct: number;
      label: string;
      confidence: string;
      data_points: number;
    }[] = [];

    for (let i = 1; i <= hoursAheadNum; i++) {
      const targetHour = (currentHour + i) % 24;

      const snapResult = await query(
        `SELECT
           AVG(occupancy_pct)  AS avg_pct,
           COUNT(*)            AS data_points
         FROM occupancy_snapshots
         WHERE location_id  = $1
           AND hour_of_day  = $2
           AND day_of_week  = $3`,
        [location_id, targetHour, currentDayOfWeek],
      );

      const row = snapResult.rows[0];
      const dataPoints = parseInt(row.data_points, 10) || 0;
      const predictedPct = dataPoints > 0 ? Math.round(Number(row.avg_pct)) : 0;

      let label: string;
      if (predictedPct > 70) label = 'Busy';
      else if (predictedPct > 40) label = 'Moderate';
      else label = 'Quiet';

      let confidence: string;
      if (dataPoints > 20) confidence = 'high';
      else if (dataPoints > 5) confidence = 'medium';
      else confidence = 'low';

      // Format hour label (e.g. "3 PM", "11 AM")
      const period = targetHour >= 12 ? 'PM' : 'AM';
      const displayHour = targetHour % 12 === 0 ? 12 : targetHour % 12;
      const hour_label = `${displayHour} ${period}`;

      predictions.push({
        hour: targetHour,
        hour_label,
        predicted_pct: predictedPct,
        label,
        confidence,
        data_points: dataPoints,
      });
    }

    res.json({
      success: true,
      location_id,
      current_hour: currentHour,
      day_of_week: currentDayOfWeek,
      predictions,
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/parking/:id/availability
// ---------------------------------------------------------------------------
// NOTE: This must come AFTER /nearby, /search, /recommendations, /predictions
//       so that those static paths are not swallowed by /:id
router.get(
  '/parking/:id/availability',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    // Fetch location
    const locResult = await query(
      `SELECT id, name, total_slots, is_open FROM parking_locations WHERE id = $1 AND is_active = true`,
      [id],
    );
    if (locResult.rows.length === 0) throw new AppError('Parking location not found', 404);

    const location = locResult.rows[0];

    // Check if individual parking_slots rows exist for this location
    const slotCountResult = await query(
      `SELECT COUNT(*) AS cnt FROM parking_slots WHERE location_id = $1`,
      [id],
    );
    const slotCount = parseInt(slotCountResult.rows[0].cnt, 10);

    if (slotCount > 0) {
      // Slot-level detail
      const statsResult = await query(
        `SELECT
           COUNT(*)                                         AS total,
           COUNT(*) FILTER (WHERE status = 'AVAILABLE')    AS available,
           COUNT(*) FILTER (WHERE status = 'OCCUPIED')     AS occupied,
           COUNT(*) FILTER (WHERE status = 'RESERVED')     AS reserved,
           COUNT(*) FILTER (WHERE status = 'MAINTENANCE')  AS maintenance
         FROM parking_slots
         WHERE location_id = $1 AND is_active = true`,
        [id],
      );

      const stats = statsResult.rows[0];
      const total = parseInt(stats.total, 10);
      const occupied = parseInt(stats.occupied, 10);
      const occupancyPct = total > 0 ? Math.round((occupied / total) * 100 * 10) / 10 : 0;

      // Individual slot details
      const slotsResult = await query(
        `SELECT id, slot_number, floor, section, status, vehicle_type, distance_from_entrance
         FROM parking_slots
         WHERE location_id = $1 AND is_active = true
         ORDER BY section, slot_number`,
        [id],
      );

      res.json({
        success: true,
        location_id: id,
        location_name: location.name,
        is_open: location.is_open,
        has_slot_detail: true,
        summary: {
          total: parseInt(stats.total, 10),
          available: parseInt(stats.available, 10),
          occupied: parseInt(stats.occupied, 10),
          reserved: parseInt(stats.reserved, 10),
          maintenance: parseInt(stats.maintenance, 10),
          occupancy_pct: occupancyPct,
        },
        slots: slotsResult.rows,
      });
    } else {
      // Aggregate from location row only
      const total = parseInt(location.total_slots, 10);
      res.json({
        success: true,
        location_id: id,
        location_name: location.name,
        is_open: location.is_open,
        has_slot_detail: false,
        summary: {
          total,
          available: total,
          occupied: 0,
          reserved: 0,
          maintenance: 0,
          occupancy_pct: 0,
        },
        slots: [],
      });
    }
  }),
);

// ---------------------------------------------------------------------------
// GET /api/user/preferences
// ---------------------------------------------------------------------------
router.get(
  '/user/preferences',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await query(
      `SELECT user_id, preference_mode, max_distance_km, preferred_vehicle_type, updated_at
       FROM user_preferences
       WHERE user_id = $1`,
      [req.user!.userId],
    );

    if (result.rows.length === 0) {
      // Return defaults
      res.json({
        success: true,
        data: {
          user_id: req.user!.userId,
          preference_mode: 'balanced',
          max_distance_km: 10,
          preferred_vehicle_type: null,
          updated_at: null,
        },
        is_default: true,
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
      is_default: false,
    });
  }),
);

// ---------------------------------------------------------------------------
// PUT /api/user/preferences
// ---------------------------------------------------------------------------
router.put(
  '/user/preferences',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { preference_mode, max_distance_km, preferred_vehicle_type } = req.body;

    const validModes = ['cheapest', 'nearest', 'most_available', 'ev_charging', 'covered', 'balanced'];
    if (preference_mode !== undefined && !validModes.includes(preference_mode)) {
      throw new AppError(`preference_mode must be one of: ${validModes.join(', ')}`, 400);
    }

    if (max_distance_km !== undefined) {
      const dist = parseFloat(max_distance_km);
      if (isNaN(dist) || dist <= 0 || dist > 500) {
        throw new AppError('max_distance_km must be a positive number up to 500', 400);
      }
    }

    const validVehicleTypes = ['CAR', 'BIKE', 'TRUCK', 'EV', null, undefined, ''];
    if (preferred_vehicle_type !== undefined && preferred_vehicle_type !== null &&
        preferred_vehicle_type !== '' &&
        !['CAR', 'BIKE', 'TRUCK', 'EV'].includes(preferred_vehicle_type)) {
      throw new AppError('preferred_vehicle_type must be one of: CAR, BIKE, TRUCK, EV', 400);
    }

    void validVehicleTypes; // suppress unused warning

    const result = await query(
      `INSERT INTO user_preferences (user_id, preference_mode, max_distance_km, preferred_vehicle_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         preference_mode        = COALESCE($2, user_preferences.preference_mode),
         max_distance_km        = COALESCE($3, user_preferences.max_distance_km),
         preferred_vehicle_type = COALESCE(NULLIF($4, ''), user_preferences.preferred_vehicle_type),
         updated_at             = NOW()
       RETURNING *`,
      [
        req.user!.userId,
        preference_mode || null,
        max_distance_km ?? null,
        preferred_vehicle_type || null,
      ],
    );

    res.json({ success: true, data: result.rows[0] });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/ai/chat
// ---------------------------------------------------------------------------

interface AiChatBody {
  message?: string;
  lat?: number;
  lng?: number;
}

router.post(
  '/ai/chat',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { message, lat, lng } = req.body as AiChatBody;

    if (!message || message.trim() === '') {
      throw new AppError('message is required', 400);
    }

    const msg = message.toLowerCase().trim();

    // Validate optional coordinates
    let userLat: number | null = null;
    let userLng: number | null = null;
    const hasCoords = lat !== undefined && lng !== undefined;

    if (hasCoords) {
      const err = validateLatLng(lat, lng);
      if (err) throw new AppError(err, 400);
      userLat = parseFloat(String(lat));
      userLng = parseFloat(String(lng));
    }

    // -----------------------------------------------------------------------
    // Intent detection
    // -----------------------------------------------------------------------
    type Intent =
      | 'nearest'
      | 'cheapest'
      | 'most_available'
      | 'ev_charging'
      | 'pricing'
      | 'busy'
      | 'summary';

    let intent: Intent = 'summary';

    if (/nearest|closest|near me/.test(msg)) {
      intent = 'nearest';
    } else if (/cheap|affordable|cheapest/.test(msg)) {
      intent = 'cheapest';
    } else if (/available|empty|free slots/.test(msg)) {
      intent = 'most_available';
    } else if (/\bev\b|electric|charging/.test(msg)) {
      intent = 'ev_charging';
    } else if (/how much|cost|price|hours/.test(msg)) {
      intent = 'pricing';
    } else if (/full|busy|occupied/.test(msg)) {
      intent = 'busy';
    }

    // -----------------------------------------------------------------------
    // Build query based on intent
    // -----------------------------------------------------------------------

    /**
     * Shared SELECT for AI responses.
     * When hasCoords is true, $1/$2 are lat/lng; otherwise we use dummy 0/0 and
     * distance_km will be irrelevant.
     */
    function aiSelectSQL(): string {
      const latP = hasCoords ? '$1' : '0';
      const lngP = hasCoords ? '$2' : '0';
      return coreSelectSQL(latP, lngP);
    }

    let locations: LocationRow[] = [];
    let reply = '';
    let queryParams: unknown[] = hasCoords ? [userLat, userLng] : [];
    let nextParam = hasCoords ? 3 : 1;

    switch (intent) {
      case 'nearest': {
        if (!hasCoords) {
          reply =
            'To find the nearest parking, please share your location. ' +
            'You can send your coordinates along with the message.';
          res.json({ success: true, reply, type: intent, locations: [] });
          return;
        }
        const sql = `
          SELECT ${aiSelectSQL()}
          FROM parking_locations pl
          WHERE pl.is_active = true AND pl.is_open = true
          ORDER BY distance_km ASC
          LIMIT 5
        `;
        const result = await query(sql, queryParams);
        locations = result.rows;

        if (locations.length === 0) {
          reply = 'No parking locations found matching your criteria.';
        } else {
          const top = locations[0];
          reply =
            `The nearest open parking is "${top.name}" — only ${top.distance_km} km away ` +
            `at ${top.address}. It has ${top.available_slots} slots available ` +
            `at ₹${top.price_per_hour}/hour.` +
            (locations.length > 1 ? ` Here are the ${locations.length} closest options:` : '');
        }
        break;
      }

      case 'cheapest': {
        const sql = `
          SELECT ${aiSelectSQL()}
          FROM parking_locations pl
          WHERE pl.is_active = true
          ORDER BY pl.price_per_hour ASC
          LIMIT 5
        `;
        const result = await query(sql, queryParams);
        locations = result.rows;

        if (locations.length === 0) {
          reply = 'No parking locations found matching your criteria.';
        } else {
          const top = locations[0];
          reply =
            `The most affordable parking is "${top.name}" at just ₹${top.price_per_hour}/hour, ` +
            `located at ${top.address}. ` +
            `It has ${top.available_slots} of ${top.total_slots} slots available.` +
            (locations.length > 1 ? ` Here are the ${locations.length} cheapest options:` : '');
        }
        break;
      }

      case 'most_available': {
        const sql = `
          SELECT ${aiSelectSQL()}
          FROM parking_locations pl
          WHERE pl.is_active = true AND pl.is_open = true
          ORDER BY (
            ${AVAILABLE_SLOTS_SQL}::float / NULLIF(pl.total_slots, 0)
          ) DESC
          LIMIT 5
        `;
        const result = await query(sql, queryParams);
        locations = result.rows;

        if (locations.length === 0) {
          reply = 'No parking locations found matching your criteria.';
        } else {
          const top = locations[0];
          const pct = Math.round(
            (top.available_slots / (top.total_slots || 1)) * 100,
          );
          reply =
            `"${top.name}" has the most availability right now — ` +
            `${top.available_slots} free slots (${pct}%) at ${top.address}. ` +
            `Pricing: ₹${top.price_per_hour}/hour.` +
            (locations.length > 1
              ? ` Here are the ${locations.length} most available locations:`
              : '');
        }
        break;
      }

      case 'ev_charging': {
        const sql = `
          SELECT ${aiSelectSQL()}
          FROM parking_locations pl
          WHERE pl.is_active = true AND pl.has_ev_charging = true
          ORDER BY ${hasCoords ? 'distance_km ASC' : 'pl.name ASC'}
          LIMIT 5
        `;
        const result = await query(sql, queryParams);
        locations = result.rows;

        if (locations.length === 0) {
          reply =
            'No parking locations with EV charging were found. ' +
            'Please check back later as we are expanding our EV network.';
        } else {
          reply =
            `Found ${locations.length} parking location${locations.length > 1 ? 's' : ''} ` +
            `with EV charging available:`;
        }
        break;
      }

      case 'pricing': {
        const sql = `
          SELECT ${aiSelectSQL()}
          FROM parking_locations pl
          WHERE pl.is_active = true
          ORDER BY pl.price_per_hour ASC
          LIMIT 10
        `;
        const result = await query(sql, queryParams);
        locations = result.rows;

        if (locations.length === 0) {
          reply = 'No parking locations found matching your criteria.';
        } else {
          const prices = locations
            .slice(0, 5)
            .map((l) => `"${l.name}": ₹${l.price_per_hour}/hr`)
            .join(', ');
          reply = `Here is a pricing overview for available parking locations — ${prices}.`;
        }
        break;
      }

      case 'busy': {
        const sql = `
          SELECT ${aiSelectSQL()}
          FROM parking_locations pl
          WHERE pl.is_active = true
          ORDER BY (
            ${OCCUPIED_SLOTS_SQL}::float / NULLIF(pl.total_slots, 0)
          ) DESC
          LIMIT 5
        `;
        const result = await query(sql, queryParams);
        locations = result.rows;

        if (locations.length === 0) {
          reply = 'No parking locations found matching your criteria.';
        } else {
          const top = locations[0];
          reply =
            `"${top.name}" is currently the busiest with ${top.occupancy_pct}% occupancy ` +
            `(${top.occupied_slots} occupied out of ${top.total_slots} total slots).` +
            (locations.length > 1 ? ` Here are the busiest locations right now:` : '');
        }
        break;
      }

      default: {
        // summary — show all active locations
        const sql = `
          SELECT ${aiSelectSQL()}
          FROM parking_locations pl
          WHERE pl.is_active = true
          ORDER BY ${hasCoords ? 'distance_km ASC' : 'pl.name ASC'}
          LIMIT $${nextParam}
        `;
        queryParams = [...queryParams, 10];
        const result = await query(sql, queryParams);
        locations = result.rows;

        if (locations.length === 0) {
          reply = 'No parking locations found matching your criteria.';
        } else {
          const openCount = locations.filter((l) => l.is_open).length;
          const totalAvail = locations.reduce(
            (sum, l) => sum + (Number(l.available_slots) || 0),
            0,
          );
          reply =
            `I found ${locations.length} parking location${locations.length > 1 ? 's' : ''} ` +
            `in the system. ${openCount} ${openCount === 1 ? 'is' : 'are'} currently open ` +
            `with a total of ${totalAvail} available slots. ` +
            `How can I help you find the right one?`;
        }
        break;
      }
    }

    res.json({
      success: true,
      type: intent,
      reply,
      locations,
    });
  }),
);

export default router;
