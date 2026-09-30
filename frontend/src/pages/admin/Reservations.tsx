import React, { useEffect, useState } from 'react';
import { CalendarCheck, XCircle } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Reservation {
  id: string; booking_id: string; user_name: string; user_email: string;
  vehicle_number: string; vehicle_type: string; slot_number: string;
  reservation_date: string; start_time: string; expected_end_time: string;
  status: string; estimated_fee: number; actual_fee?: number;
}

const statusColor: Record<string, string> = {
  CONFIRMED: 'bg-blue-100 text-blue-700', ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600', CANCELLED: 'bg-red-100 text-red-600',
  OVERSTAY: 'bg-orange-100 text-orange-700', PENDING: 'bg-yellow-100 text-yellow-700',
};

export default function AdminReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchReservations = async () => {
    try {
      const params = statusFilter !== 'ALL' ? `?status=${statusFilter}&limit=50` : '?limit=50';
      const res = await api.get(`/reservations${params}`);
      setReservations(res.data.data);
    } catch { toast.error('Failed to load reservations'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReservations(); }, [statusFilter]);

  const handleCancel = async (id: string, bookingId: string) => {
    if (!confirm(`Cancel reservation ${bookingId}?`)) return;
    try {
      await api.delete(`/reservations/${id}`);
      toast.success('Reservation cancelled');
      fetchReservations();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to cancel');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Reservations</h1>
        <p className="text-gray-500 mt-1">View and manage all parking reservations</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['ALL', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'OVERSTAY'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
      ) : reservations.length === 0 ? (
        <div className="card text-center py-16">
          <CalendarCheck className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">No reservations found</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Booking ID', 'User', 'Vehicle', 'Slot', 'Date', 'Time', 'Fee', 'Status', 'Actions'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reservations.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono text-xs font-bold text-gray-900">{r.booking_id}</td>
                    <td className="table-cell">
                      <div className="font-medium text-sm">{r.user_name}</div>
                      <div className="text-xs text-gray-400">{r.user_email}</div>
                    </td>
                    <td className="table-cell text-sm">{r.vehicle_number}</td>
                    <td className="table-cell font-semibold text-blue-600">{r.slot_number}</td>
                    <td className="table-cell text-sm whitespace-nowrap">
                      {new Date(r.reservation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="table-cell text-xs whitespace-nowrap">
                      {new Date(r.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–
                      {new Date(r.expected_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="table-cell font-semibold">₹{r.actual_fee ?? r.estimated_fee}</td>
                    <td className="table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.status] || 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                    </td>
                    <td className="table-cell">
                      {['CONFIRMED', 'PENDING'].includes(r.status) && (
                        <button onClick={() => handleCancel(r.id, r.booking_id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
