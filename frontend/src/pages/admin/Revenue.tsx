import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { IndianRupee, TrendingUp } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface RevenueData {
  today: number;
  weekly: number;
  monthly: number;
  daily_breakdown: { date: string; transactions: number; revenue: number }[];
}

export default function AdminRevenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/revenue')
      .then(res => setData(res.data.data))
      .catch(() => toast.error('Failed to load revenue data'))
      .finally(() => setLoading(false));
  }, []);

  const StatCard = ({ label, value, sub }: { label: string; value: number; sub?: string }) => (
    <div className="card flex items-center gap-4">
      <div className="p-3 rounded-xl bg-green-500">
        <IndianRupee className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">₹{loading ? '—' : value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  const chartData = data?.daily_breakdown.slice(-14).map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue: parseFloat(String(d.revenue)),
    transactions: d.transactions,
  })).reverse() || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
        <p className="text-gray-500 mt-1">Parking fee collection summary</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Today's Revenue" value={data?.today || 0} />
        <StatCard label="This Week" value={data?.weekly || 0} sub="Last 7 days" />
        <StatCard label="This Month" value={data?.monthly || 0} sub="Current month" />
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Daily Revenue (Last 14 Days)</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Daily Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Transactions</th>
                <th className="table-header">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={3} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : data?.daily_breakdown.slice(0, 20).map(d => (
                <tr key={d.date} className="hover:bg-gray-50">
                  <td className="table-cell">{new Date(d.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                  <td className="table-cell text-center">{d.transactions}</td>
                  <td className="table-cell font-semibold text-green-700">₹{parseFloat(String(d.revenue)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
