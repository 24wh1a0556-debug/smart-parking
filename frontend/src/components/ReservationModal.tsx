import React, { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import api from '../lib/api';

interface Slot {
  id: string; slot_number: string; floor: string; section: string;
  vehicle_type: string; distance_from_entrance: number;
}

interface Vehicle {
  id: string; vehicle_number: string; vehicle_type: string; vehicle_model: string; nickname?: string;
}

interface ReservationResult {
  booking_id: string; slot_number: string; vehicle_number: string;
  reservation_date: string; start_time: string; expected_end_time: string;
  estimated_fee: number; fee_breakdown: string; qr_code: string;
}

interface Props {
  slot: Slot;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReservationModal({ slot, onClose, onSuccess }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [result, setResult] = useState<ReservationResult | null>(null);

  useEffect(() => {
    api.get('/vehicles').then(res => {
      const filtered = res.data.data.filter((v: Vehicle) =>
        slot.vehicle_type === 'ANY' || v.vehicle_type === slot.vehicle_type
      );
      setVehicles(filtered);
    }).catch(() => toast.error('Failed to load vehicles'));

    // Default times
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    setStartTime(now.toTimeString().slice(0, 5));
    setEndTime(later.toTimeString().slice(0, 5));
  }, [slot.vehicle_type]);

  useEffect(() => {
    if (startTime && endTime && date) {
      const start = new Date(`${date}T${startTime}`);
      const end = new Date(`${date}T${endTime}`);
      if (end > start) {
        const durationHours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
        const fee = durationHours === 1 ? 20 : 20 + (durationHours - 1) * 10;
        setEstimatedFee(fee);
      }
    }
  }, [startTime, endTime, date]);

  const handleConfirm = async () => {
    if (!selectedVehicle) { toast.error('Please select a vehicle'); return; }
    setLoading(true);
    try {
      const startDateTime = new Date(`${date}T${startTime}`);
      const endDateTime = new Date(`${date}T${endTime}`);

      const res = await api.post('/reservations', {
        slot_id: slot.id,
        vehicle_id: selectedVehicle,
        reservation_date: date,
        start_time: startDateTime.toISOString(),
        expected_end_time: endDateTime.toISOString(),
      });

      setResult(res.data.data);
      setStep('success');
      toast.success('Reservation confirmed!');
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Reservation failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const canvas = document.getElementById('booking-qr') as HTMLCanvasElement;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `booking-${result?.booking_id}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const vehicle = vehicles.find(v => v.id === selectedVehicle);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {step === 'form' ? `Reserve Slot ${slot.slot_number}` :
             step === 'confirm' ? 'Confirm Reservation' : 'Booking Confirmed! 🎉'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {step === 'form' && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
                <strong>{slot.slot_number}</strong> — {slot.floor} · {slot.distance_from_entrance}m from entrance
              </div>

              {vehicles.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
                  No compatible vehicles found. Please add a {slot.vehicle_type !== 'ANY' ? slot.vehicle_type.toLowerCase() : 'vehicle'} first.
                  <a href="/vehicles" className="font-semibold ml-1 underline">Add Vehicle</a>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Vehicle</label>
                  <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}
                    className="input-field">
                    <option value="">Choose a vehicle</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.vehicle_number} — {v.vehicle_model} ({v.vehicle_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input type="date" value={date} min={new Date().toISOString().split('T')[0]}
                  onChange={e => setDate(e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Time</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">End Time</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="input-field" />
                </div>
              </div>

              {estimatedFee !== null && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <p className="text-sm text-green-700 font-medium">Estimated Fee: <strong>₹{estimatedFee}</strong></p>
                  <p className="text-xs text-green-600 mt-0.5">1st hour ₹20 + additional hours ₹10/hr</p>
                </div>
              )}

              <button
                onClick={() => { if (!selectedVehicle) { toast.error('Select a vehicle'); return; } setStep('confirm'); }}
                disabled={!selectedVehicle || vehicles.length === 0}
                className="btn-primary w-full"
              >
                Review Reservation
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              {[
                { label: 'Slot', value: slot.slot_number },
                { label: 'Floor', value: slot.floor },
                { label: 'Vehicle', value: vehicle ? `${vehicle.vehicle_number} (${vehicle.vehicle_model})` : '' },
                { label: 'Date', value: new Date(date).toLocaleDateString('en-IN', { dateStyle: 'long' }) },
                { label: 'Start', value: startTime },
                { label: 'Expected End', value: endTime },
                { label: 'Estimated Fee', value: `₹${estimatedFee}` },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{row.value}</span>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('form')} className="btn-secondary flex-1">Back</button>
                <button onClick={handleConfirm} disabled={loading} className="btn-primary flex-1">
                  {loading ? <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : 'Confirm Reservation'}
                </button>
              </div>
            </div>
          )}

          {step === 'success' && result && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Booking Confirmed!</h3>
                <p className="text-sm text-gray-500 mt-1">Booking ID: <strong className="text-gray-900">{result.booking_id}</strong></p>
              </div>
              <div className="flex justify-center">
                <QRCodeCanvas
                  id="booking-qr"
                  value={JSON.stringify({ bookingId: result.booking_id, slot: result.slot_number })}
                  size={160}
                  level="H"
                  includeMargin
                />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-left space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Slot</span><span className="font-medium">{result.slot_number}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Vehicle</span><span className="font-medium">{result.vehicle_number}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Est. Fee</span><span className="font-medium">₹{result.estimated_fee}</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={downloadQR} className="btn-secondary flex-1 text-sm">
                  <Download className="w-4 h-4" /> Download QR
                </button>
                <button onClick={onClose} className="btn-primary flex-1 text-sm">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
