import React, { useEffect, useState } from 'react';
import { User, Mail, Phone, Shield, Pencil, Save, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  created_at: string;
}

export default function UserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me').then(res => {
      setProfile(res.data.data);
      setForm({ full_name: res.data.data.full_name, phone: res.data.data.phone || '' });
    }).catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error('Full name is required'); return; }
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', { full_name: form.full_name, phone: form.phone || undefined });
      setProfile(prev => prev ? { ...prev, ...res.data.data } : null);
      setEditing(false);
      toast.success('Profile updated');
    } catch { toast.error('Failed to update profile'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 mt-1">Manage your account information</p>
      </div>

      <div className="card">
        {/* Avatar */}
        <div className="flex items-center gap-5 mb-6 pb-6 border-b border-gray-100">
          <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-bold text-white flex-shrink-0">
            {profile?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile?.full_name}</h2>
            <p className="text-gray-500 text-sm">{profile?.email}</p>
            <span className={`inline-flex items-center gap-1 mt-1 text-xs px-2.5 py-0.5 rounded-full font-semibold ${
              profile?.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              <Shield className="w-3 h-3" /> {profile?.role}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
            {editing ? (
              <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="input-field" />
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-800">{profile?.full_name}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-gray-800">{profile?.email}</span>
              <span className="ml-auto text-xs text-gray-400">Cannot be changed</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
            {editing ? (
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                placeholder="Enter phone number" className="input-field" />
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-800">{profile?.phone || 'Not provided'}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Member Since</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-800">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex gap-3">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn-secondary flex-1">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary">
              <Pencil className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
