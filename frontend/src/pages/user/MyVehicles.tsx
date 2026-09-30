import React, { useEffect, useState } from 'react';
import { Truck, Plus, Pencil, Trash2, X, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  vehicle_model: string;
  nickname?: string;
  created_at: string;
}

const vehicleIcon: Record<string, string> = { CAR: '🚗', BIKE: '🏍️', TRUCK: '🚛', EV: '⚡' };
const vehicleColor: Record<string, string> = {
  CAR: 'bg-blue-50 text-blue-700',
  BIKE: 'bg-green-50 text-green-700',
  TRUCK: 'bg-orange-50 text-orange-700',
  EV: 'bg-purple-50 text-purple-700',
};

interface FormData { vehicle_number: string; vehicle_type: string; vehicle_model: string; nickname: string; }
const emptyForm: FormData = { vehicle_number: '', vehicle_type: 'CAR', vehicle_model: '', nickname: '' };

export default function MyVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchVehicles = async () => {
    try {
      const res = await api.get('/vehicles');
      setVehicles(res.data.data);
    } catch { toast.error('Failed to load vehicles'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchVehicles(); }, []);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setFormError(''); setShowForm(true); };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({ vehicle_number: v.vehicle_number, vehicle_type: v.vehicle_type, vehicle_model: v.vehicle_model, nickname: v.nickname || '' });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.vehicle_number.trim()) { setFormError('Vehicle number is required'); return; }
    if (!form.vehicle_model.trim()) { setFormError('Vehicle model is required'); return; }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/vehicles/${editing.id}`, {
          vehicle_type: form.vehicle_type,
          vehicle_model: form.vehicle_model,
          nickname: form.nickname || undefined,
        });
        toast.success('Vehicle updated');
      } else {
        await api.post('/vehicles', {
          vehicle_number: form.vehicle_number.toUpperCase(),
          vehicle_type: form.vehicle_type,
          vehicle_model: form.vehicle_model,
          nickname: form.nickname || undefined,
        });
        toast.success('Vehicle added');
      }
      setShowForm(false);
      fetchVehicles();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save vehicle';
      setFormError(msg);
    } finally { setSaving(false); }
  };

  const handleDelete = async (v: Vehicle) => {
    if (!confirm(`Delete vehicle ${v.vehicle_number}?`)) return;
    try {
      await api.delete(`/vehicles/${v.id}`);
      toast.success('Vehicle deleted');
      fetchVehicles();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Vehicles</h1>
          <p className="text-gray-500 mt-1">Manage your registered vehicles</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
      ) : vehicles.length === 0 ? (
        <div className="card text-center py-16">
          <Truck className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 text-lg">No vehicles added</h3>
          <p className="text-gray-400 text-sm mt-1">Add your vehicles to make reservations</p>
          <button onClick={openAdd} className="btn-primary mt-4 mx-auto">
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <div key={v.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${vehicleColor[v.vehicle_type] || 'bg-gray-50'}`}>
                    {vehicleIcon[v.vehicle_type] || '🚗'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{v.vehicle_number}</p>
                    <p className="text-sm text-gray-600">{v.vehicle_model}</p>
                    {v.nickname && <p className="text-xs text-gray-400">"{v.nickname}"</p>}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${vehicleColor[v.vehicle_type] || 'bg-gray-100 text-gray-600'}`}>
                  {v.vehicle_type}
                </span>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => openEdit(v)} className="btn-secondary flex-1 text-sm py-2">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => handleDelete(v)} className="btn-danger flex-1 text-sm py-2">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editing ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vehicle Number</label>
                <input value={form.vehicle_number} onChange={e => setForm({...form, vehicle_number: e.target.value.toUpperCase()})}
                  placeholder="e.g. TS09AB1234" className="input-field"
                  disabled={!!editing} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vehicle Type</label>
                <select value={form.vehicle_type} onChange={e => setForm({...form, vehicle_type: e.target.value})} className="input-field">
                  {['CAR', 'BIKE', 'TRUCK', 'EV'].map(t => <option key={t} value={t}>{vehicleIcon[t]} {t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vehicle Model</label>
                <input value={form.vehicle_model} onChange={e => setForm({...form, vehicle_model: e.target.value})}
                  placeholder="e.g. Honda City" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nickname (optional)</label>
                <input value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})}
                  placeholder="e.g. My Honda" className="input-field" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : (editing ? 'Save Changes' : 'Add Vehicle')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
