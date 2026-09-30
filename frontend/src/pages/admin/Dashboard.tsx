import React, { useEffect, useState } from 'react';
import {
  ParkingSquare,
  Users,
  CalendarCheck,
  IndianRupee,
  Activity,
  AlertTriangle
} from 'lucide-react';
import api from '../../lib/api';

interface DashboardData {
  slots: {
    total_slots: string;
    available: string;
    occupied: string;
    reserved: string;
    maintenance: string;
  };
  users: {
    total_users: string;
    active_users: string;
  };
  today_reservations: number;
  today_revenue: number;
  active_sessions: number;
  overstay_alerts: number;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/dashboard')
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const StatCard = ({
    icon: Icon,
    label,
    value,
    sub,
    color
  }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
  }) => (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>

      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">
          {loading ? '—' : value}
        </p>

        {sub && (
          <p className="text-xs text-gray-400 mt-0.5">
            {sub}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Admin Dashboard
        </h1>

        <p className="text-gray-500 mt-1">
          System overview and real-time statistics
        </p>
      </div>

      {/* Overstay Alert */}
      {data && data.overstay_alerts > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />

          <p className="text-orange-800 font-medium text-sm">
            {data.overstay_alerts} vehicle(s) have exceeded their reserved parking time
          </p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

        <StatCard
          icon={ParkingSquare}
          label="Total Slots"
          value={data?.slots.total_slots || 0}
          color="bg-blue-600"
        />

        <StatCard
          icon={ParkingSquare}
          label="Available Slots"
          value={data?.slots.available || 0}
          sub={`${data?.slots.occupied || 0} occupied · ${data?.slots.reserved || 0} reserved`}
          color="bg-green-500"
        />

        <StatCard
          icon={ParkingSquare}
          label="Maintenance"
          value={data?.slots.maintenance || 0}
          color="bg-gray-400"
        />

        <StatCard
          icon={Users}
          label="Total Users"
          value={data?.users.total_users || 0}
          sub={`${data?.users.active_users || 0} active`}
          color="bg-purple-600"
        />

        <StatCard
          icon={CalendarCheck}
          label="Today's Reservations"
          value={data?.today_reservations || 0}
          color="bg-indigo-500"
        />

        <StatCard
          icon={Activity}
          label="Active Sessions"
          value={data?.active_sessions || 0}
          color="bg-teal-500"
        />

      </div>

      {/* Revenue and Slot Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">
            Today's Revenue
          </h2>

          <p className="text-4xl font-black text-gray-900">
            ₹{loading ? '—' : data?.today_revenue?.toFixed(2) || '0.00'}
          </p>

          <p className="text-sm text-gray-500 mt-2">
            From completed parking sessions today
          </p>
        </div>

        <div className="card">

          <h2 className="font-semibold text-gray-900 mb-4">
            Slot Status Breakdown
          </h2>

          <div className="space-y-3">

            {[
              {
                label: 'Available',
                value: data?.slots.available,
                total: data?.slots.total_slots,
                color: 'bg-green-500'
              },
              {
                label: 'Occupied',
                value: data?.slots.occupied,
                total: data?.slots.total_slots,
                color: 'bg-red-500'
              },
              {
                label: 'Reserved',
                value: data?.slots.reserved,
                total: data?.slots.total_slots,
                color: 'bg-yellow-500'
              },
              {
                label: 'Maintenance',
                value: data?.slots.maintenance,
                total: data?.slots.total_slots,
                color: 'bg-gray-400'
              }
            ].map(item => {

              const pct = data
                ? Math.round(
                    (parseInt(item.value || '0') /
                      parseInt(item.total || '1')) *
                      100
                  )
                : 0;

              return (
                <div key={item.label}>

                  <div className="flex justify-between text-sm mb-1">

                    <span className="text-gray-600">
                      {item.label}
                    </span>

                    <span className="font-medium">
                      {loading ? '—' : item.value} ({pct}%)
                    </span>

                  </div>

                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">

                    <div
                      className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />

                  </div>

                </div>
              );
            })}

          </div>
        </div>

      </div>

    </div>
  );
}