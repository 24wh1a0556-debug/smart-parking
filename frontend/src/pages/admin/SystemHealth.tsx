import React, { useEffect, useState } from 'react';
import { Activity, Database, Server, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface HealthData {
  status: string; database: string; db_time: string;
  uptime_seconds: number; memory_usage: { heapUsed: number; heapTotal: number; rss: number }; node_version: string;
}

interface PublicHealth {
  status: string; database: string; timestamp: string; uptime: number; version: string;
}

export default function SystemHealth() {
  const [health, setHealth] = useState<PublicHealth | null>(null);
  const [adminHealth, setAdminHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const [publicRes, adminRes] = await Promise.all([
        api.get('/health'),
        api.get('/admin/system-health'),
      ]);
      setHealth(publicRes.data);
      setAdminHealth(adminRes.data.data);
      setLastChecked(new Date());
    } catch { toast.error('Failed to fetch health data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchHealth(); }, []);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 mt-1">
            {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Loading...'}
          </p>
        </div>
        <button onClick={fetchHealth} disabled={loading} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'API Status', value: health?.status || 'unknown', icon: Server, ok: health?.status === 'healthy' },
          { label: 'Database', value: health?.database || 'unknown', icon: Database, ok: health?.database === 'connected' },
          { label: 'Version', value: health?.version || '—', icon: Activity, ok: true },
        ].map(item => (
          <div key={item.label} className="card flex items-center gap-4">
            <div className={`p-3 rounded-xl ${item.ok ? 'bg-green-100' : 'bg-red-100'}`}>
              <item.icon className={`w-6 h-6 ${item.ok ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{item.label}</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 capitalize">{item.value}</p>
                {item.ok ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed stats */}
      {adminHealth && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Runtime</h2>
            <div className="space-y-3">
              {[
                { label: 'Uptime', value: formatUptime(adminHealth.uptime_seconds) },
                { label: 'Node.js Version', value: adminHealth.node_version },
                { label: 'DB Server Time', value: new Date(adminHealth.db_time).toLocaleString() },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Memory Usage</h2>
            <div className="space-y-3">
              {[
                { label: 'Heap Used', value: formatBytes(adminHealth.memory_usage.heapUsed), pct: Math.round((adminHealth.memory_usage.heapUsed / adminHealth.memory_usage.heapTotal) * 100) },
                { label: 'Heap Total', value: formatBytes(adminHealth.memory_usage.heapTotal), pct: 100 },
                { label: 'RSS (Process)', value: formatBytes(adminHealth.memory_usage.rss), pct: null },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">{item.label}</span>
                    <span className="font-medium">{item.value}{item.pct !== null ? ` (${item.pct}%)` : ''}</span>
                  </div>
                  {item.pct !== null && (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.pct > 80 ? 'bg-red-500' : item.pct > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${item.pct}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Health endpoint info */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Health Endpoints</h2>
        <div className="space-y-2">
          {[
            { url: 'GET /api/health', desc: 'Public health check (used by Kubernetes probes)', status: 'active' },
            { url: 'GET /metrics', desc: 'Prometheus metrics endpoint', status: 'active' },
            { url: 'GET /api/admin/system-health', desc: 'Detailed admin system health', status: 'active' },
          ].map(ep => (
            <div key={ep.url} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <code className="text-sm font-mono text-gray-900">{ep.url}</code>
                <p className="text-xs text-gray-500 mt-0.5">{ep.desc}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
