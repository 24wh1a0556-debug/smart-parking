import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface AnalyticsData {
  hourly_occupancy: { hour: number; count: number; occupancy_percent: number }[];
  daily_stats: { date: string; reservations: number; revenue: number }[];
  slot_usage: { slot_number: string; total_reservations: number }[];
  vehicle_types: { vehicle_type: string; count: number }[];
  peak_hours: { hour: number; sessions: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');

  useEffect(() => {
    api.get(`/admin/analytics?days=${days}`)
      .then(res => setData(res.data.data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [days]);

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}${period}`;
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;

  // Occupancy prediction message
  const peakOccupancy = data?.hourly_occupancy.reduce((max, curr) => curr.occupancy_percent > max.occupancy_percent ? curr : max, { hour: 0, occupancy_percent: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Parking usage patterns and insights</p>
        </div>
        <select value={days} onChange={e => setDays(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* Occupancy prediction banner */}
      {peakOccupancy && peakOccupancy.occupancy_percent > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-800 text-sm font-medium">
            📊 Based on historical data, parking is expected to be highest (~{Math.round(peakOccupancy.occupancy_percent)}% occupancy) around {formatHour(peakOccupancy.hour)}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Hourly occupancy */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Hourly Occupancy Pattern</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.hourly_occupancy.map(d => ({ ...d, hour: formatHour(d.hour) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: number) => [`${Math.round(v)}%`, 'Occupancy']} />
              <Bar dataKey="occupancy_percent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily reservations */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Daily Reservations</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.daily_stats.slice(-14).map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="reservations" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Vehicle types */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Vehicle Type Distribution</h2>
          {data?.vehicle_types.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No data available</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={data?.vehicle_types} dataKey="count" nameKey="vehicle_type" cx="50%" cy="50%" outerRadius={70}>
                    {data?.vehicle_types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {data?.vehicle_types.map((v, i) => (
                  <div key={v.vehicle_type} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-600">{v.vehicle_type}</span>
                    <span className="font-semibold ml-auto">{v.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top slots */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Most Used Slots</h2>
          <div className="space-y-2">
            {data?.slot_usage.slice(0, 8).map((s, i) => (
              <div key={s.slot_number} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                <span className="font-medium text-gray-900 w-10">{s.slot_number}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(s.total_reservations / (data?.slot_usage[0]?.total_reservations || 1)) * 100}%` }} />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-8 text-right">{s.total_reservations}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
