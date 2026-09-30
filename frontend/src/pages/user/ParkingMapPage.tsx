import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import ParkingMap, { ParkingLocation } from '../../components/ParkingMap';

// ── Default fallback centre when user has not shared location ────────────────
// (matches the seed-data location: Hyderabad, India)
const DEFAULT_LAT = 17.4485;
const DEFAULT_LNG = 78.3908;
const DEFAULT_RADIUS_KM = 20; // fetch locations within 20 km of centre

export default function ParkingMapPage() {
  // ── Parking data state ──────────────────────────────────────────────────
  const [locations, setLocations] = useState<ParkingLocation[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  // ── Geolocation state ────────────────────────────────────────────────────
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const watchRef = useRef<number | null>(null);

  // ── Fetch parking locations from backend ─────────────────────────────────
  const fetchLocations = useCallback(
    async (lat: number, lng: number) => {
      setLoadingData(true);
      setDataError('');
      try {
        const res = await api.get<{
          success: boolean;
          count: number;
          data: ParkingLocation[];
        }>(`/parking/nearby?lat=${lat}&lng=${lng}&radius=${DEFAULT_RADIUS_KM}`);

        if (res.data.success) {
          setLocations(res.data.data);
          if (res.data.count === 0) {
            toast('No parking locations found within 20 km of your position.', {
              icon: 'ℹ️',
            });
          }
        }
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to load parking locations.';
        setDataError(msg);
        toast.error(msg);
      } finally {
        setLoadingData(false);
      }
    },
    []
  );

  // ── Request user geolocation ─────────────────────────────────────────────
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError('');

    // Clear any previous watcher
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
    }

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const pos2d = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPosition(pos2d);
        setIsLocating(false);
        // Refetch with accurate position
        fetchLocations(pos2d.lat, pos2d.lng);
      },
      (err) => {
        setIsLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError(
              'Location permission denied. Please allow location access in your browser settings.'
            );
            break;
          case err.POSITION_UNAVAILABLE:
            setLocationError('Your location is currently unavailable. Please try again.');
            break;
          case err.TIMEOUT:
            setLocationError('Location request timed out. Please try again.');
            break;
          default:
            setLocationError('Could not get your location. Please try again.');
        }
        // Still load parking locations using the default centre
        fetchLocations(DEFAULT_LAT, DEFAULT_LNG);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, [fetchLocations]);

  // ── On mount: load locations with default centre; auto-request GPS ───────
  useEffect(() => {
    // Load data immediately with default coordinates so the map
    // is not empty while waiting for GPS permission.
    fetchLocations(DEFAULT_LAT, DEFAULT_LNG);

    // Silently attempt auto-geolocation
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const pos2d = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPosition(pos2d);
          setIsLocating(false);
          fetchLocations(pos2d.lat, pos2d.lng);
        },
        () => {
          // Permission not granted or unavailable — silently ignore,
          // user can click "Use My Location" button.
          setIsLocating(false);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    }

    // Cleanup watcher on unmount
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Manual refresh ────────────────────────────────────────────────────────
  const handleRefresh = () => {
    const centre = userPosition ?? { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
    fetchLocations(centre.lat, centre.lng);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const openCount = locations.filter((l) => l.is_open).length;
  const totalAvailable = locations.reduce((s, l) => s + (l.available_slots || 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-600" />
            Parking Map
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            View all parking locations near you. Tap a marker to see details.
          </p>
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={loadingData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700
                     bg-white border border-gray-200 rounded-xl hover:bg-gray-50
                     disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      {locations.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{locations.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Locations</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{openCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Open Now</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalAvailable}</p>
            <p className="text-xs text-gray-500 mt-0.5">Free Slots</p>
          </div>
        </div>
      )}

      {/* Data error banner */}
      {dataError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">{dataError}</p>
            <button
              onClick={handleRefresh}
              className="text-xs text-red-600 underline mt-1 hover:text-red-800"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Google Map */}
      <ParkingMap
        locations={locations}
        userPosition={userPosition}
        isLocating={isLocating}
        locationError={locationError}
        onRequestLocation={requestLocation}
        height="540px"
      />

      {/* Location list below the map */}
      {locations.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900">
            All Parking Locations
            {userPosition && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                — sorted by distance
              </span>
            )}
          </h2>

          {locations.map((loc) => {
            const availPct =
              loc.total_slots > 0
                ? Math.round((loc.available_slots / loc.total_slots) * 100)
                : 0;

            const barColour =
              availPct > 50 ? 'bg-green-500' : availPct > 20 ? 'bg-amber-500' : 'bg-red-500';

            return (
              <div
                key={loc.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4
                           hover:border-blue-300 hover:shadow-sm transition-all"
              >
                {/* Colour indicator */}
                <div
                  className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
                    !loc.is_open
                      ? 'bg-gray-400'
                      : availPct > 50
                      ? 'bg-green-500'
                      : availPct > 20
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 truncate">{loc.name}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
                        loc.is_open
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {loc.is_open ? 'Open' : 'Closed'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mt-0.5 truncate">{loc.address}</p>

                  {/* Distance + Price */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    {loc.distance_km != null && (
                      <span>📍 {Number(loc.distance_km).toFixed(1)} km</span>
                    )}
                    <span>₹{loc.price_per_hour}/hr</span>
                    {loc.has_ev_charging && <span className="text-blue-600">⚡ EV</span>}
                    {loc.has_covered && <span className="text-amber-600">🏠 Covered</span>}
                  </div>

                  {/* Availability bar */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Availability</span>
                      <span className="font-medium">
                        {loc.available_slots}/{loc.total_slots} free
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColour} transition-all`}
                        style={{ width: `${availPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
