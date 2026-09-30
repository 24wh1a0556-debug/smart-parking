import React, { useEffect, useState } from 'react';
import { Plus, Pencil, X, AlertCircle, ParkingSquare } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Slot {
  id: string; slot_number: string; floor: string; status: string;
  vehicle_type: string; distance_from_entrance: number; section: string; is_active: boolean;
}

const statusColor: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700',
  OCCUPIED: 'bg-red-100 text-red-700',
  RESERVED: 'bg-yellow-100 text-yellow-700',
  MAINTENANCE: 'bg-gray-100 text-gray-600',
};

const emptyForm = { slot_number: '', floor: 'Ground Floor', vehicle_type: 'CAR', distance_from_entrance: 0, section: 'A', status: 'AVAILABLE' };

export default function AdminParkingSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchSlots = async () => {
    try {
      const params = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const res = await api.get(`/parking/slots${params}`);
      setSlots(res.data.data);
    } catch { toast.error('Failed to load slots'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSlots(); }, [statusFilter]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setFormError(''); setShowForm(true); };
  const openEdit = (s: Slot) => {
    setEditing(s);
    setForm({ slot_number: s.slot_number, floor: s.floor, vehicle_type: s.vehicle_type, distance_from_entrance: s.distance_from_entrance, section: s.section, status: s.status });
    setFormError(''); setShowForm(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.slot_number.trim() && !editing) { setFormError('Slot number is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/parking/slots/${editing.id}`, form);
        toast.success('Slot updated');
      } else {
        await api.post('/parking/slots', form);
        toast.success('Slot added');
      }
      setShowForm(false); fetchSlots();
    } catch (err: unknown) {
      setFormError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.put(`/parking/slots/${id}`, { status });
      toast.success('Status updated');
      fetchSlots();
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parking Slot Management</h1>
          <p className="text-gray-500 mt-1">Add, edit and manage all parking slots</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Slot</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Slot', 'Floor', 'Section', 'Vehicle Type', 'Distance', 'Status', 'Actions'].map(h => <th key={h} className="table-header">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {slots.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="table-cell font-bold text-gray-900">{s.slot_number}</td>
                    <td className="table-cell">{s.floor}</td>
                    <td className="table-cell">{s.section}</td>
                    <td className="table-cell">{s.vehicle_type}</td>
                    <td className="table-cell">{s.distance_from_entrance}m</td>
                    <td className="table-cell">
                      <select value={s.status} onChange={e => handleStatusChange(s.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${statusColor[s.status] || 'bg-gray-100 text-gray-600'}`}>
                        {['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'].map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">{editing ? 'Edit Slot' : 'Add Slot'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {formError && <div className="mb-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-sm text-red-600"><AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}</div>}
            <div className="space-y-4">
              {!editing && <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Slot Number</label>
                <input value={form.slot_number} onChange={e => setForm({...form, slot_number: e.target.value.toUpperCase()})} placeholder="e.g. A1" className="input-field" /></div>}
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Floor</label>
                <input value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Section</label>
                  <input value={form.section} onChange={e => setForm({...form, section: e.target.value.toUpperCase()})} maxLength={2} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Distance (m)</label>
                  <input type="number" value={form.distance_from_entrance} onChange={e => setForm({...form, distance_from_entrance: parseInt(e.target.value)})} className="input-field" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Vehicle Type</label>
                <select value={form.vehicle_type} onChange={e => setForm({...form, vehicle_type: e.target.value})} className="input-field">
                  {['CAR', 'BIKE', 'TRUCK', 'EV', 'ANY'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-field">
                  {['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : (editing ? 'Save' : 'Add Slot')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
