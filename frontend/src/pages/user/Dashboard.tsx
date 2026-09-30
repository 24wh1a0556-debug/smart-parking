import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ParkingSquare, Car, CalendarCheck, History, AlertTriangle, ArrowRight } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardStats {
  available: string; occupied: string; reserved: string; maintenance: string; total: string;
}
interface ActiveReservation {
  booking_id: string; slot_number: string; vehicle_number: string;
  start_time: string; expected_end_time: string; status: string;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [slotStats, setSlotStats] = useState<DashboardStats | null>(null);
  const [activeRes, setActiveRes] = useState<ActiveReservation | null>(null);
  const [visitCount, setVisitCount] = useState(0);
  const [overstay, setOverstay] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, resRes, historyRes, overstayRes] = await Promise.all([
          api.get('/parking/slots/stats'),
          api.get('/reservations?status=ACTIVE&limit=1'),
          api.get('/parking/history?status=COMPLETED&limit=1'),
          api.get('/parking/overstay'),
        ]);

        setSlotStats(statsRes.data.data);
        setActiveRes(resRes.data.data[0] || null);
        setVisitCount(historyRes.data.data.length > 0 ? historyRes.data.total || 0 : 0);
        setOverstay(overstayRes.data.data);
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const StatCard = ({ icon: Icon, label, value, color, link }: {
    icon: React.ElementType; label: string; value: string | number; color: string; link?: string;
  }) => (
    <div className={`card flex items-center gap-4 ${link ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{loading ? '—' : value}</p>
      </div>
      {link && <Link to={link}><ArrowRight className="w-4 h-4 text-gray-400" /></Link>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Here's your parking overview for today</p>
      </div>

      {/* Overstay alert */}
      {overstay.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-800 font-semibold text-sm">Parking Time Exceeded</p>
            <p className="text-orange-700 text-sm mt-0.5">
              You have {overstay.length} parking session(s) that have exceeded the reserved time.
              Please exit or contact the parking staff.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={ParkingSquare} label="Available Slots" value={slotStats?.available || 0}
          color="bg-green-500" link="/parking-slots" />
        <StatCard icon={Car} label="Occupied Slots" value={slotStats?.occupied || 0}
          color="bg-red-500" />
        <StatCard icon={CalendarCheck}
          label="Active Reservation"
          value={activeRes ? activeRes.slot_number : 'None'}
          color="bg-blue-500" link="/reservations" />
        <StatCard icon={History} label="Total Visits" value={visitCount}
          color="bg-purple-500" link="/history" />
      </div>

      {/* Active Reservation */}
      {activeRes && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Reservation</h2>
            <span className="badge-available">Active</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Booking ID</p>
              <p className="font-bold text-gray-900">{activeRes.booking_id}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Slot</p>
              <p className="font-bold text-gray-900">{activeRes.slot_number}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Vehicle</p>
              <p className="font-bold text-gray-900 truncate">{activeRes.vehicle_number}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Expected Exit</p>
              <p className="font-bold text-gray-900">
                {new Date(activeRes.expected_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Find Best Slot', path: '/find-slot', icon: '🎯', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-100' },
            { label: 'View Slots', path: '/parking-slots', icon: '🅿️', color: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-100' },
            { label: 'My Vehicles', path: '/vehicles', icon: '🚗', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-100' },
            { label: 'History', path: '/history', icon: '📋', color: 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-100' },
          ].map((action) => (
            <Link key={action.path} to={action.path}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${action.color}`}>
              <span className="text-2xl">{action.icon}</span>
              <span className="text-sm font-medium text-center leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Parking slot summary */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Parking Area Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Available', value: slotStats?.available, color: 'text-green-600', bg: 'bg-green-50', dot: 'bg-green-500' },
            { label: 'Occupied', value: slotStats?.occupied, color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' },
            { label: 'Reserved', value: slotStats?.reserved, color: 'text-yellow-600', bg: 'bg-yellow-50', dot: 'bg-yellow-500' },
            { label: 'Maintenance', value: slotStats?.maintenance, color: 'text-gray-600', bg: 'bg-gray-50', dot: 'bg-gray-400' },
          ].map((item) => (
            <div key={item.label} className={`${item.bg} rounded-xl p-4 flex items-center gap-3`}>
              <div className={`w-3 h-3 rounded-full ${item.dot} flex-shrink-0`} />
              <div>
                <p className={`text-xl font-bold ${item.color}`}>{loading ? '—' : item.value}</p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
