import React, { useEffect, useState } from 'react';
import { X, MapPin, Car, Clock, CheckCircle, AlertCircle, Wrench } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import ReservationModal from '../../components/ReservationModal';

interface Slot {
  id: string; slot_number: string; floor: string; status: string;
  vehicle_type: string; distance_from_entrance: number; section: string;
}

const statusConfig = {
  AVAILABLE: { label: 'Available', color: 'bg-green-100 border-green-300 text-green-800', dot: 'bg-green-500', icon: CheckCircle },
  OCCUPIED: { label: 'Occupied', color: 'bg-red-100 border-red-300 text-red-800', dot: 'bg-red-500', icon: AlertCircle },
  RESERVED: { label: 'Reserved', color: 'bg-yellow-100 border-yellow-300 text-yellow-800', dot: 'bg-yellow-500', icon: Clock },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-gray-100 border-gray-300 text-gray-500', dot: 'bg-gray-400', icon: Wrench },
};

const vehicleIcon = { CAR: '🚗', BIKE: '🏍️', TRUCK: '🚛', EV: '⚡', ANY: '🅿️' };

export default function ParkingSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [showReservation, setShowReservation] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');

  const fetchSlots = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterSection !== 'ALL') params.append('section', filterSection);
      const res = await api.get(`/parking/slots?${params}`);
      setSlots(res.data.data);
    } catch { toast.error('Failed to load parking slots'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSlots(); }, [filterStatus, filterSection]);

  // Group slots by section
  const sections = [...new Set(slots.map(s => s.section))].sort();
  const slotsBySection = sections.reduce((acc, sec) => {
    acc[sec] = slots.filter(s => s.section === sec);
    return acc;
  }, {} as Record<string, Slot[]>);

  const stats = {
    total: slots.length,
    available: slots.filter(s => s.status === 'AVAILABLE').length,
    occupied: slots.filter(s => s.status === 'OCCUPIED').length,
    reserved: slots.filter(s => s.status === 'RESERVED').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parking Slots</h1>
          <p className="text-gray-500 mt-1">Click on an available slot to reserve it</p>
        </div>
        <button onClick={fetchSlots} className="btn-secondary text-sm">
          <span>Refresh</span>
        </button>
      </div>

      {/* Legend */}
      <div className="card flex flex-wrap gap-4">
        {Object.entries(statusConfig).map(([status, cfg]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
            <span className="text-sm text-gray-600">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, bg: 'bg-gray-50' },
          { label: 'Available', value: stats.available, bg: 'bg-green-50 text-green-700' },
          { label: 'Occupied', value: stats.occupied, bg: 'bg-red-50 text-red-700' },
          { label: 'Reserved', value: stats.reserved, bg: 'bg-yellow-50 text-yellow-700' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs mt-0.5 text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ALL">All Status</option>
            {Object.keys(statusConfig).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Section</label>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ALL">All Sections</option>
            {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(slotsBySection).map(([section, sectionSlots]) => (
            <div key={section} className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                  {section}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Section {section}</h3>
                  <p className="text-xs text-gray-500">{sectionSlots[0]?.floor}</p>
                </div>
                <div className="ml-auto text-sm text-gray-500">
                  {sectionSlots.filter(s => s.status === 'AVAILABLE').length} available
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10 gap-2">
                {sectionSlots.map((slot) => {
                  const cfg = statusConfig[slot.status as keyof typeof statusConfig];
                  const isAvailable = slot.status === 'AVAILABLE';
                  return (
                    <button
                      key={slot.id}
                      onClick={() => { setSelectedSlot(slot); }}
                      disabled={!isAvailable}
                      className={`
                        relative p-3 rounded-xl border-2 text-center transition-all duration-150
                        ${cfg.color}
                        ${isAvailable ? 'hover:scale-105 hover:shadow-md cursor-pointer' : 'cursor-not-allowed opacity-80'}
                      `}
                    >
                      <div className="text-lg mb-1">{vehicleIcon[slot.vehicle_type as keyof typeof vehicleIcon] || '🅿️'}</div>
                      <div className="text-xs font-bold">{slot.slot_number}</div>
                      <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${cfg.dot}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slot Detail Modal */}
      {selectedSlot && !showReservation && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Slot {selectedSlot.slot_number}</h3>
              <button onClick={() => setSelectedSlot(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`text-sm font-semibold ${
                  selectedSlot.status === 'AVAILABLE' ? 'text-green-600' :
                  selectedSlot.status === 'OCCUPIED' ? 'text-red-600' :
                  selectedSlot.status === 'RESERVED' ? 'text-yellow-600' : 'text-gray-500'
                }`}>{selectedSlot.status}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-500 flex items-center gap-2"><MapPin className="w-4 h-4" />Floor</span>
                <span className="text-sm font-medium">{selectedSlot.floor}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-500 flex items-center gap-2"><Car className="w-4 h-4" />Vehicle Type</span>
                <span className="text-sm font-medium">{vehicleIcon[selectedSlot.vehicle_type as keyof typeof vehicleIcon]} {selectedSlot.vehicle_type}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-500">Distance</span>
                <span className="text-sm font-medium">{selectedSlot.distance_from_entrance}m from entrance</span>
              </div>
            </div>
            {selectedSlot.status === 'AVAILABLE' ? (
              <button
                onClick={() => setShowReservation(true)}
                className="btn-primary w-full"
              >
                <CalendarCheck /> Reserve Slot
              </button>
            ) : (
              <button disabled className="btn-secondary w-full opacity-50 cursor-not-allowed">
                Not Available
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reservation Modal */}
      {showReservation && selectedSlot && (
        <ReservationModal
          slot={selectedSlot}
          onClose={() => { setShowReservation(false); setSelectedSlot(null); }}
          onSuccess={() => { setShowReservation(false); setSelectedSlot(null); fetchSlots(); }}
        />
      )}
    </div>
  );
}

// Small inline import needed
const CalendarCheck = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
