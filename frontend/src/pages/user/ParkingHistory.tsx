import React, { useEffect, useState } from 'react';
import { History, Clock, IndianRupee } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface HistoryItem {
  id: string;
  booking_id: string;
  slot_number: string;
  vehicle_number: string;
  vehicle_model: string;
  reservation_date: string;
  start_time: string;
  expected_end_time: string;
  actual_end_time?: string;
  status: string;
  estimated_fee: number;
  actual_fee?: number;
  entry_time?: string;
  exit_time?: string;
  actual_duration_minutes?: number;
  final_fee?: number;
}

const statusBadge: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
  ACTIVE: 'bg-blue-100 text-blue-700',
  OVERSTAY: 'bg-orange-100 text-orange-700',
};

export default function ParkingHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const params = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
        const res = await api.get(`/parking/history${params}`);
        setHistory(res.data.data);
      } catch { toast.error('Failed to load history'); }
      finally { setLoading(false); }
    };
    fetchHistory();
  }, [statusFilter]);

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Parking History</h1>
        <p className="text-gray-500 mt-1">Your past parking sessions</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['ALL', 'COMPLETED', 'ACTIVE', 'CANCELLED', 'OVERSTAY'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
      ) : history.length === 0 ? (
        <div className="card text-center py-16">
          <History className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 text-lg">No history yet</h3>
          <p className="text-gray-400 text-sm mt-1">Your completed parking sessions will appear here</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'Booking ID', 'Slot', 'Vehicle', 'Duration', 'Fee', 'Status'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell whitespace-nowrap">
                      {new Date(item.reservation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="table-cell font-mono text-xs font-semibold text-gray-900">{item.booking_id}</td>
                    <td className="table-cell font-semibold text-blue-600">{item.slot_number}</td>
                    <td className="table-cell">
                      <div>{item.vehicle_number}</div>
                      <div className="text-xs text-gray-400">{item.vehicle_model}</div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(item.actual_duration_minutes)}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-0.5 font-semibold text-gray-900">
                        <IndianRupee className="w-3.5 h-3.5" />
                        {item.final_fee ?? item.actual_fee ?? item.estimated_fee}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge[item.status] || 'bg-gray-100 text-gray-600'}`}>
                        {item.status}
                      </span>
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
