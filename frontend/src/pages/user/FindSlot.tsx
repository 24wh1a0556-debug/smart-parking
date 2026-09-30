import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Zap, Navigation, Car, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import ReservationModal from '../../components/ReservationModal';

// ── Fix Leaflet's broken default icon paths when bundled with Vite ──────────
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

// ── Custom icons ─────────────────────────────────────────────────────────────
const userIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:#3b82f6;border:3px solid white;
    box-shadow:0 0 0 3px rgba(59,130,246,0.4);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const parkingIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:36px;height:36px;border-radius:8px;
    background:#ef4444;color:white;font-weight:900;font-size:18px;
    display:flex;align-items:center;justify-content:center;
    border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);
  ">P</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

// ── Helper: fit map bounds to user + parking ──────────────────────────────────
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(positions, { padding: [60, 60] });
    }
  }, [positions, map]);
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Slot {
  id: string;
  slot_number: string;
  floor: string;
  section: string;
  vehicle_type: string;
  distance_from_entrance: number;
  status: string;
}

interface ParkingLocation {
  name: string;
  lat: number;
  lng: number;
  address: string;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FindSlot() {
  const [vehicleType, setVehicleType]     = useState('CAR');
  const [slots, setSlots]                 = useState<Slot[]>([]);
  const [loading, setLoading]             = useState(false);
  const [searched, setSearched]           = useState(false);
  const [selectedSlot, setSelectedSlot]   = useState<Slot | null>(null);

  // Location state
  const [userPos, setUserPos]             = useState<[number, number] | null>(null);
  const [parkingLoc, setParkingLoc]       = useState<ParkingLocation | null>(null);
  const [routeCoords, setRouteCoords]     = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo]         = useState<{ distance: string; duration: string } | null>(null);
  const [locError, setLocError]           = useState<string>('');
  const [locLoading, setLocLoading]       = useState(false);
  const [mapReady, setMapReady]           = useState(false);

  const locWatchRef = useRef<number | null>(null);

  // ── Load parking lot location from API once ──────────────────────────────
  useEffect(() => {
    api.get('/parking/location')
      .then(res => setParkingLoc(res.data.data))
      .catch(() => {/* non-critical */});
  }, []);

  // ── Cleanup geolocation watcher on unmount ───────────────────────────────
  useEffect(() => {
    return () => {
      if (locWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locWatchRef.current);
      }
    };
  }, []);

  // ── Fetch route from OSRM whenever both positions are known ─────────────
  useEffect(() => {
    if (!userPos || !parkingLoc) return;

    const fetchRoute = async () => {
      try {
        const [uLat, uLng] = userPos;
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${uLng},${uLat};${parkingLoc.lng},${parkingLoc.lat}` +
          `?overview=full&geometries=geojson`;

        const resp = await fetch(url);
        if (!resp.ok) throw new Error('OSRM error');
        const data = await resp.json();

        if (data.routes?.length) {
          const route = data.routes[0];
          // GeoJSON coords are [lng, lat] — flip to [lat, lng] for Leaflet
          const coords: [number, number][] = route.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng]
          );
          setRouteCoords(coords);

          const distKm  = (route.distance / 1000).toFixed(1);
          const durMin  = Math.round(route.duration / 60);
          setRouteInfo({ distance: `${distKm} km`, duration: `${durMin} min` });
        }
      } catch {
        // Fallback: straight line
        setRouteCoords([userPos, [parkingLoc.lat, parkingLoc.lng]]);
        setRouteInfo(null);
      }
    };

    fetchRoute();
  }, [userPos, parkingLoc]);

  // ── Get user location ────────────────────────────────────────────────────
  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    setLocLoading(true);
    setLocError('');

    if (locWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locWatchRef.current);
    }

    locWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setLocLoading(false);
        setMapReady(true);
      },
      (err) => {
        setLocLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocError('Location permission denied. Please allow location access in your browser.');
        } else {
          setLocError('Could not get your location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // ── Search slots ─────────────────────────────────────────────────────────
  const findSlots = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/parking/slots/best?vehicle_type=${vehicleType}`);
      setSlots(res.data.data);
      setSearched(true);
      if (res.data.data.length === 0) {
        toast.error('No available slots for this vehicle type');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const recommended = slots[0];

  const mapPositions: [number, number][] = [
    ...(userPos ? [userPos] : []),
    ...(parkingLoc ? [[parkingLoc.lat, parkingLoc.lng] as [number, number]] : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find Nearest Slot</h1>
        <p className="text-gray-500 mt-1">
          Share your location to see the route to the parking lot and find available slots.
        </p>
      </div>

      {/* Location card */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            Your Location
          </h2>
          {userPos && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
              ● Live tracking
            </span>
          )}
        </div>

        {locError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-600">{locError}</p>
          </div>
        )}

        {userPos ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{userPos[0].toFixed(5)}, {userPos[1].toFixed(5)}</span>
              {routeInfo && (
                <span className="ml-3 text-blue-600 font-semibold">
                  🗺 {routeInfo.distance} · {routeInfo.duration} drive
                </span>
              )}
            </div>
            <button onClick={getLocation} className="btn-secondary text-sm py-1.5 px-3">
              Refresh
            </button>
          </div>
        ) : (
          <button
            onClick={getLocation}
            disabled={locLoading}
            className="btn-primary flex items-center gap-2"
          >
            {locLoading
              ? <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" />
              : <MapPin className="w-4 h-4" />
            }
            {locLoading ? 'Getting location…' : 'Share My Location'}
          </button>
        )}
      </div>

      {/* Map */}
      {(mapReady || parkingLoc) && (
        <div className="card p-0 overflow-hidden rounded-2xl">
          <div style={{ height: '380px', width: '100%' }}>
            <MapContainer
              center={userPos ?? (parkingLoc ? [parkingLoc.lat, parkingLoc.lng] : [17.4485, 78.3908])}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* User pin */}
              {userPos && (
                <Marker position={userPos} icon={userIcon}>
                  <Popup>
                    <div className="text-sm font-semibold">📍 You are here</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {userPos[0].toFixed(5)}, {userPos[1].toFixed(5)}
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Parking lot pin */}
              {parkingLoc && (
                <Marker position={[parkingLoc.lat, parkingLoc.lng]} icon={parkingIcon}>
                  <Popup>
                    <div className="text-sm font-semibold">{parkingLoc.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{parkingLoc.address}</div>
                    {routeInfo && (
                      <div className="text-xs text-blue-600 mt-1 font-medium">
                        {routeInfo.distance} · {routeInfo.duration} from you
                      </div>
                    )}
                  </Popup>
                </Marker>
              )}

              {/* Route line */}
              {routeCoords.length > 1 && (
                <Polyline
                  positions={routeCoords}
                  pathOptions={{
                    color: '#3b82f6',
                    weight: 5,
                    opacity: 0.85,
                    dashArray: routeInfo ? undefined : '8 6',
                  }}
                />
              )}

              {/* Fit map to show both markers */}
              {mapPositions.length >= 2 && <FitBounds positions={mapPositions} />}
            </MapContainer>
          </div>

          {/* Map legend */}
          <div className="flex items-center gap-6 px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Your location
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-500 inline-block" /> Parking lot
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-1 bg-blue-500 inline-block rounded" /> Route
            </span>
            {routeInfo && (
              <span className="ml-auto font-medium text-blue-600">
                {routeInfo.distance} · ~{routeInfo.duration}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Search by vehicle type */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Car className="w-4 h-4 text-gray-600" />
          Find Available Slots
        </h2>
        <div className="flex flex-wrap gap-3 mb-4">
          {['CAR', 'BIKE', 'TRUCK', 'EV'].map(type => (
            <button
              key={type}
              onClick={() => setVehicleType(type)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors
                ${vehicleType === type
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}
            >
              {type === 'CAR' ? '🚗' : type === 'BIKE' ? '🏍️' : type === 'TRUCK' ? '🚛' : '⚡'} {type}
            </button>
          ))}
        </div>
        <button onClick={findSlots} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading
            ? <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" />
            : <Search className="w-4 h-4" />
          }
          {loading ? 'Searching…' : 'Find Nearest Slots'}
        </button>
      </div>

      {/* Recommended slot */}
      {searched && recommended && (
        <div className="card border-2 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-blue-800">Recommended Slot</h2>
          </div>
          <div className="bg-white rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-3xl font-black text-gray-900">{recommended.slot_number}</div>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {recommended.distance_from_entrance}m from entrance
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{recommended.floor}</div>
            </div>
            <button
              onClick={() => setSelectedSlot(recommended)}
              className="btn-primary whitespace-nowrap"
            >
              Reserve {recommended.slot_number}
            </button>
          </div>
        </div>
      )}

      {/* All available slots */}
      {searched && slots.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Available Slots — Closest to Entrance</h2>
          <div className="space-y-2">
            {slots.map((slot, idx) => (
              <div
                key={slot.id}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-100
                           hover:border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 font-bold
                                  flex items-center justify-center text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{slot.slot_number}</div>
                    <div className="text-xs text-gray-500">{slot.floor} · {slot.vehicle_type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{slot.distance_from_entrance}m</div>
                    <div className="text-xs text-gray-400">from entrance</div>
                  </div>
                  <button
                    onClick={() => setSelectedSlot(slot)}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    Reserve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No slots */}
      {searched && slots.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">🚫</div>
          <h3 className="font-semibold text-gray-700">No Available Slots</h3>
          <p className="text-gray-500 text-sm mt-1">No slots available for {vehicleType} right now.</p>
        </div>
      )}

      {/* Reservation modal */}
      {selectedSlot && (
        <ReservationModal
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onSuccess={() => { setSelectedSlot(null); findSlots(); }}
        />
      )}
    </div>
  );
}
