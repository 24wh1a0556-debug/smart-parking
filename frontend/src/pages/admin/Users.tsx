import React, { useEffect, useState } from 'react';
import { Users, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface User {
  id: string; full_name: string; email: string; phone: string; role: string;
  is_active: boolean; created_at: string; vehicle_count: string; total_reservations: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users?limit=100');
      setUsers(res.data.data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleUser = async (id: string, name: string) => {
    try {
      const res = await api.put(`/admin/users/${id}/toggle`);
      toast.success(`${name} ${res.data.data.is_active ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch { toast.error('Failed to update user'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-500 mt-1">{users.length} registered users</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['User', 'Email', 'Phone', 'Role', 'Vehicles', 'Reservations', 'Joined', 'Status'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-60' : ''}`}>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${u.role === 'ADMIN' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                          {u.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="table-cell text-gray-600">{u.email}</td>
                    <td className="table-cell text-gray-500">{u.phone || '—'}</td>
                    <td className="table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="table-cell text-center">{u.vehicle_count}</td>
                    <td className="table-cell text-center">{u.total_reservations}</td>
                    <td className="table-cell text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="table-cell">
                      {u.role !== 'ADMIN' ? (
                        <button onClick={() => toggleUser(u.id, u.full_name)}
                          className={`flex items-center gap-1 text-sm font-medium transition-colors ${u.is_active ? 'text-green-600 hover:text-red-500' : 'text-red-500 hover:text-green-600'}`}>
                          {u.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          {u.is_active ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <span className="text-xs text-purple-600 font-medium">Admin</span>
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
