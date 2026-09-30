import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle, XCircle, Search } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface VerifyResult {
  booking_id?: string; slot_number?: string; vehicle_number?: string;
  user_name?: string; start_time?: string; expected_end_time?: string;
  entry_time?: string; exit_time?: string; final_fee?: number;
  duration_display?: string; message?: string;
}

export default function EntryExit() {
  const [entryBookingId, setEntryBookingId] = useState('');
  const [exitBookingId, setExitBookingId] = useState('');
  const [verifyId, setVerifyId] = useState('');
  const [entryResult, setEntryResult] = useState<VerifyResult | null>(null);
  const [exitResult, setExitResult] = useState<VerifyResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; data?: VerifyResult; message: string } | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [exitLoading, setExitLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const handleEntry = async () => {
    if (!entryBookingId.trim()) { toast.error('Enter a booking ID'); return; }
    setEntryLoading(true); setEntryResult(null);
    try {
      const res = await api.post('/parking/entry', { booking_id: entryBookingId.toUpperCase() });
      setEntryResult(res.data.data);
      toast.success('Entry recorded successfully');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Entry failed';
      toast.error(msg);
    } finally { setEntryLoading(false); }
  };

  const handleExit = async () => {
    if (!exitBookingId.trim()) { toast.error('Enter a booking ID'); return; }
    setExitLoading(true); setExitResult(null);
    try {
      const res = await api.post('/parking/exit', { booking_id: exitBookingId.toUpperCase() });
      setExitResult(res.data.data);
      toast.success('Exit recorded. Session completed!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Exit failed';
      toast.error(msg);
    } finally { setExitLoading(false); }
  };

  const handleVerify = async () => {
    if (!verifyId.trim()) { toast.error('Enter a booking ID'); return; }
    setVerifyLoading(true); setVerifyResult(null);
    try {
      const res = await api.get(`/parking/verify/${verifyId.toUpperCase()}`);
      setVerifyResult(res.data);
    } catch { toast.error('Verification failed'); }
    finally { setVerifyLoading(false); }
  };

  const ResultCard = ({ data, type }: { data: VerifyResult; type: 'entry' | 'exit' }) => (
    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span className="font-semibold text-green-700">{type === 'entry' ? 'Entry Recorded' : 'Exit Recorded'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {data.slot_number && <><span className="text-gray-500">Slot</span><span className="font-medium">{data.slot_number}</span></>}
        {data.vehicle_number && <><span className="text-gray-500">Vehicle</span><span className="font-medium">{data.vehicle_number}</span></>}
        {type === 'exit' && data.duration_display && <><span className="text-gray-500">Duration</span><span className="font-medium">{data.duration_display}</span></>}
        {type === 'exit' && data.final_fee !== undefined && <><span className="text-gray-500">Final Fee</span><span className="font-bold text-green-700">₹{data.final_fee}</span></>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Entry / Exit Management</h1>
        <p className="text-gray-500 mt-1">Verify bookings and record vehicle entry and exit</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Verify */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-blue-100"><Search className="w-5 h-5 text-blue-600" /></div>
            <h2 className="font-semibold text-gray-900">Verify Booking</h2>
          </div>
          <input value={verifyId} onChange={e => setVerifyId(e.target.value.toUpperCase())}
            placeholder="Enter Booking ID" className="input-field mb-3"
            onKeyDown={e => e.key === 'Enter' && handleVerify()} />
          <button onClick={handleVerify} disabled={verifyLoading} className="btn-secondary w-full">
            {verifyLoading ? <span className="animate-spin h-4 w-4 border-b-2 border-gray-600 rounded-full" /> : <Search className="w-4 h-4" />} Verify
          </button>
          {verifyResult && (
            <div className={`mt-4 p-4 rounded-xl border ${verifyResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {verifyResult.valid ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                <span className={`font-semibold text-sm ${verifyResult.valid ? 'text-green-700' : 'text-red-700'}`}>{verifyResult.message}</span>
              </div>
              {verifyResult.valid && verifyResult.data && (
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">Slot: </span><strong>{(verifyResult.data as unknown as { slot_number: string }).slot_number}</strong></p>
                  <p><span className="text-gray-500">Vehicle: </span><strong>{(verifyResult.data as unknown as { vehicle_number: string }).vehicle_number}</strong></p>
                  <p><span className="text-gray-500">User: </span><strong>{(verifyResult.data as unknown as { user_name: string }).user_name}</strong></p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Entry */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-green-100"><ArrowRight className="w-5 h-5 text-green-600" /></div>
            <h2 className="font-semibold text-gray-900">Record Entry</h2>
          </div>
          <input value={entryBookingId} onChange={e => setEntryBookingId(e.target.value.toUpperCase())}
            placeholder="Enter Booking ID" className="input-field mb-3"
            onKeyDown={e => e.key === 'Enter' && handleEntry()} />
          <button onClick={handleEntry} disabled={entryLoading} className="btn-primary w-full bg-green-600 hover:bg-green-700">
            {entryLoading ? <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <ArrowRight className="w-4 h-4" />} Verify Entry
          </button>
          {entryResult && <ResultCard data={entryResult} type="entry" />}
        </div>

        {/* Exit */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-orange-100"><ArrowLeft className="w-5 h-5 text-orange-600" /></div>
            <h2 className="font-semibold text-gray-900">Record Exit</h2>
          </div>
          <input value={exitBookingId} onChange={e => setExitBookingId(e.target.value.toUpperCase())}
            placeholder="Enter Booking ID" className="input-field mb-3"
            onKeyDown={e => e.key === 'Enter' && handleExit()} />
          <button onClick={handleExit} disabled={exitLoading} className="btn-primary w-full bg-orange-600 hover:bg-orange-700">
            {exitLoading ? <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <ArrowLeft className="w-4 h-4" />} Verify Exit
          </button>
          {exitResult && <ResultCard data={exitResult} type="exit" />}
        </div>
      </div>
    </div>
  );
}
