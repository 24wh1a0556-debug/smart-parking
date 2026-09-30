import React, { useEffect, useRef, useCallback } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useGoogleMaps } from '../hooks/useGoogleMaps';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParkingLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km: number | null;
  price_per_hour: number;
  total_slots: number;
  available_slots: number;
  occupied_slots: number;
  is_open: boolean;
  has_ev_charging: boolean;
  has_covered: boolean;
}

interface ParkingMapProps {
  /** Parking locations fetched from the backend */
  locations: ParkingLocation[];
  /** User's current GPS position, null when not yet obtained */
  userPosition: { lat: number; lng: number } | null;
  /** Whether geolocation is currently being fetched */
  isLocating: boolean;
  /** Geolocation error message, if any */
  locationError: string;
  /** Trigger geolocation lookup */
  onRequestLocation: () => void;
  /** Map height — defaults to '520px' */
  height?: string;
}

// ── Colour helpers ────────────────────────────────────────────────────────────

/** Returns a fill colour based on available-slot ratio */
function markerColour(loc: ParkingLocation): string {
  if (!loc.is_open) return '#6b7280'; // grey  — closed
  const ratio =
    loc.total_slots > 0 ? loc.available_slots / loc.total_slots : 0;
  if (ratio > 0.5) return '#16a34a'; // green — plenty
  if (ratio > 0.2) return '#d97706'; // amber — filling up
  return '#dc2626';                   // red   — almost full
}

// ── SVG marker factory ────────────────────────────────────────────────────────

function buildMarkerSvg(colour: string): string {
  return encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
  </defs>
  <path d="M20 0 C9 0 0 9 0 20 C0 33 20 50 20 50 C20 50 40 33 40 20 C40 9 31 0 20 0Z"
        fill="${colour}" filter="url(#shadow)"/>
  <circle cx="20" cy="20" r="11" fill="white" opacity="0.9"/>
  <text x="20" y="25" text-anchor="middle" font-family="Arial,sans-serif"
        font-size="13" font-weight="900" fill="${colour}">P</text>
</svg>`).trim();
}

// ── ParkingMap component ──────────────────────────────────────────────────────

export default function ParkingMap({
  locations,
  userPosition,
  isLocating,
  locationError,
  onRequestLocation,
  height = '520px',
}: ParkingMapProps) {
  const { isLoaded, isLoading, hasError } = useGoogleMaps();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // ── Initialise the map once the API is loaded ───────────────────────────
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    // Default centre: Hyderabad, India (matches existing seed data)
    const defaultCenter = { lat: 17.4485, lng: 78.3908 };

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: userPosition ?? defaultCenter,
      zoom: userPosition ? 13 : 12,
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false,
      zoomControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_CENTER,
      },
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });

    infoWindowRef.current = new window.google.maps.InfoWindow();
  }, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update user marker whenever position changes ────────────────────────
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !userPosition) return;

    if (!userMarkerRef.current) {
      // Pulsing blue dot for user location
      userMarkerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        title: 'Your Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 1000,
      });
    }

    userMarkerRef.current.setPosition(userPosition);
    mapInstanceRef.current.panTo(userPosition);
    mapInstanceRef.current.setZoom(13);
  }, [isLoaded, userPosition]);

  // ── Render / update parking markers when locations or map changes ───────
  const renderMarkers = useCallback(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    locations.forEach((loc) => {
      const colour = markerColour(loc);
      const svgUrl = `data:image/svg+xml,${buildMarkerSvg(colour)}`;

      const marker = new window.google.maps.Marker({
        map: mapInstanceRef.current!,
        position: { lat: Number(loc.lat), lng: Number(loc.lng) },
        title: loc.name,
        icon: {
          url: svgUrl,
          scaledSize: new window.google.maps.Size(40, 50),
          anchor: new window.google.maps.Point(20, 50),
        },
        zIndex: 500,
      });

      // ── Info window content ──────────────────────────────────────────
      const availPct =
        loc.total_slots > 0
          ? Math.round((loc.available_slots / loc.total_slots) * 100)
          : 0;

      const statusBadge = loc.is_open
        ? `<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">● Open</span>`
        : `<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">● Closed</span>`;

      const evBadge = loc.has_ev_charging
        ? `<span style="background:#eff6ff;color:#2563eb;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">⚡ EV</span>`
        : '';

      const coveredBadge = loc.has_covered
        ? `<span style="background:#fefce8;color:#a16207;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">🏠 Covered</span>`
        : '';

      const distanceText =
        loc.distance_km != null
          ? `<div style="color:#6b7280;font-size:12px;margin-bottom:8px;">📍 ${Number(loc.distance_km).toFixed(1)} km away</div>`
          : '';

      const slotBarWidth = `${availPct}%`;
      const slotBarColour =
        availPct > 50 ? '#16a34a' : availPct > 20 ? '#d97706' : '#dc2626';

      const infoContent = `
        <div style="font-family:Inter,system-ui,sans-serif;min-width:220px;max-width:280px;padding:4px;">
          <div style="font-weight:700;font-size:15px;color:#111827;margin-bottom:4px;">${loc.name}</div>
          <div style="color:#6b7280;font-size:12px;margin-bottom:8px;">${loc.address}</div>
          ${distanceText}
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
            ${statusBadge} ${evBadge} ${coveredBadge}
          </div>

          <!-- Availability bar -->
          <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
              <span style="color:#374151;font-weight:600;">Availability</span>
              <span style="color:${slotBarColour};font-weight:700;">${loc.available_slots}/${loc.total_slots} free</span>
            </div>
            <div style="height:6px;background:#e5e7eb;border-radius:9999px;overflow:hidden;">
              <div style="height:100%;width:${slotBarWidth};background:${slotBarColour};border-radius:9999px;transition:width .3s;"></div>
            </div>
          </div>

          <!-- Price -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid #f3f4f6;">
            <span style="font-size:12px;color:#6b7280;">Price / hour</span>
            <span style="font-size:15px;font-weight:700;color:#1d4ed8;">₹${loc.price_per_hour}</span>
          </div>
        </div>
      `;

      marker.addListener('click', () => {
        infoWindowRef.current?.setContent(infoContent);
        infoWindowRef.current?.open(mapInstanceRef.current ?? undefined, marker);
      });

      markersRef.current.push(marker);
    });

    // Auto-fit bounds to show all locations + user position
    if (locations.length > 0 || userPosition) {
      const bounds = new window.google.maps.LatLngBounds();
      if (userPosition) bounds.extend(userPosition);
      locations.forEach((loc) =>
        bounds.extend({ lat: Number(loc.lat), lng: Number(loc.lng) })
      );
      mapInstanceRef.current.fitBounds(bounds, { top: 60, right: 40, bottom: 60, left: 40 });
    }
  }, [isLoaded, locations, userPosition]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  // ── Render states ─────────────────────────────────────────────────────────

  if (hasError) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-red-50 border border-red-200 rounded-2xl"
        style={{ height }}
      >
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="font-semibold text-red-700">Google Maps failed to load</p>
        <p className="text-sm text-red-500 mt-1 text-center px-6">
          Check that <code className="bg-red-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> is set
          correctly in your <code className="bg-red-100 px-1 rounded">.env</code> file, then
          rebuild.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-2xl"
        style={{ height }}
      >
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
        <p className="text-gray-600 font-medium">Loading Google Maps…</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height }}>
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* "Use My Location" button — overlaid on the map */}
      <div className="absolute top-3 left-3 z-10">
        <button
          onClick={onRequestLocation}
          disabled={isLocating}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md
                     border border-gray-200 text-sm font-semibold text-gray-700
                     hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300
                     disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
          )}
          {isLocating ? 'Locating…' : 'Use My Location'}
        </button>

        {/* Geolocation error bubble */}
        {locationError && (
          <div className="mt-2 flex items-start gap-2 bg-white border border-red-200 rounded-xl
                          shadow-md px-3 py-2 max-w-xs">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600">{locationError}</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm border
                      border-gray-200 rounded-xl shadow-sm px-3 py-2 flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block ring-2 ring-blue-200" /> You
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-600 inline-block" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Filling up
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-600 inline-block" /> Almost full
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-400 inline-block" /> Closed
        </span>
      </div>
    </div>
  );
}
