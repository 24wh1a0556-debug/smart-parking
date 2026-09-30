import React, { useEffect, useState } from 'react';
import { CalendarCheck, XCircle, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Reservation {
  id: string;
  booking_id: string;
  slot_number: string;
  vehicle_number: string;
  vehicle_model: string;
  reservation_date: string;
  start_time: string;
  expected_end_time: string;
  status: string;
  estimated_fee: number;
  qr_code?: string;
}

const statusBadge: Record<string, string> = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
  OVERSTAY: 'bg-orange-100 text-orange-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
};

export default function MyReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchReservations = async () => {
    try {
      const params = filter !== 'ALL' ? `?status=${filter}` : '';
      const res = await api.get(`/reservations${params}`);
      setReservations(res.data.data);
    } catch {
      toast.error('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReservations(); }, [filter]);

  const handleCancel = async (id: string, bookingId: string) => {
    if (!confirm(`Cancel reservation ${bookingId}?`)) return;
    setCancelling(id);
    try {
      await api.delete(`/reservations/${id}`);
      toast.success('Reservation cancelled');
      fetchReservations();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to cancel';
      toast.error(msg);
    } finally {
      setCancelling(null);
    }
  };

  const filters = ['ALL', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Reservations</h1>
        <p className="text-gray-500 mt-1">View and manage your parking reservations</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="card text-center py-16">
          <CalendarCheck className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 text-lg">No reservations found</h3>
          <p className="text-gray-400 text-sm mt-1">
            {filter !== 'ALL' ? `No ${filter.toLowerCase()} reservations` : 'You have not made any reservations yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => (
            <div key={res.id} className="card hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <CalendarCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{res.booking_id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[res.status] || 'bg-gray-100 text-gray-600'}`}>
                        {res.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Slot <strong>{res.slot_number}</strong> · {res.vehicle_number}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(res.reservation_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })} ·{' '}
                      {new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                      {new Date(res.expected_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">₹{res.estimated_fee}</p>
                    <p className="text-xs text-gray-400">Est. fee</p>
                  </div>
                  {['CONFIRMED', 'PENDING'].includes(res.status) && (
                    <button
                      onClick={() => handleCancel(res.id, res.booking_id)}
                      disabled={cancelling === res.id}
                      className="btn-danger text-sm py-2 px-3"
                    >
                      {cancelling === res.id ? (
                        <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
