import React, { useEffect, useState } from 'react';
import { Bell, Trash2, CheckCheck } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const typeColor: Record<string, string> = {
  WELCOME: 'bg-blue-100 text-blue-700',
  RESERVATION_CONFIRMED: 'bg-green-100 text-green-700',
  RESERVATION_CANCELLED: 'bg-red-100 text-red-600',
  SESSION_COMPLETED: 'bg-gray-100 text-gray-600',
  OVERSTAY: 'bg-orange-100 text-orange-700',
  PARKING_REMINDER: 'bg-yellow-100 text-yellow-700',
};

export default function UserNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=50');
      setNotifications(res.data.data);
    } catch { toast.error('Failed to load notifications'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed to update'); }
  };

  const deleteNotif = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1">{unread > 0 ? `${unread} unread` : 'All caught up'}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
      ) : notifications.length === 0 ? (
        <div className="card text-center py-16">
          <Bell className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 text-lg">No notifications</h3>
          <p className="text-gray-400 text-sm mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id}
              className={`card flex items-start gap-4 transition-colors ${!n.is_read ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[n.type] || 'bg-gray-100 text-gray-600'}`}>
                    {n.type.replace(/_/g, ' ')}
                  </span>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                </div>
                <p className="font-semibold text-gray-900 mt-1">{n.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              <button onClick={() => deleteNotif(n.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
