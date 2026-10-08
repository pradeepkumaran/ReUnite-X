import React, { useState, useEffect } from 'react';
import { 
  Ambulance, 
  UserPlus, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  ArrowRight, 
  Heart, 
  Activity, 
  RefreshCw,
  Search,
  Filter,
  Navigation,
  Building2,
  Tent
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { saveReportOffline } from '../db/indexedDB';
import PhotoCapture from '../components/common/PhotoCapture';

export default function RescueTeamDashboard() {
  const { user } = useAuth();
  const { isOnline, setPendingCount } = useNetwork();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Registration Form State
  const [form, setForm] = useState({
    full_name: '',
    approximate_age: '',
    gender: 'unknown',
    description: '',
    clothing_details: '',
    physical_marks: '',
    triage_tag: 'yellow', // red, yellow, green, black
    rescue_location_name: '',
    rescue_lat: 10.7685,
    rescue_lng: 79.8430,
    transport_destination: '',
    rescue_unit: '',
    medical_condition: '',
    is_vulnerable: false,
    photo_file: null,
    photo_preview: null,
  });

  const fetchRescuedCases = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cases?case_type=found');
      setCases(res.data);
    } catch (err) {
      console.warn('Rescue cases fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRescuedCases();
  }, []);

  const handleRegisterRescued = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    const clientUuid = crypto.randomUUID();
    const payload = {
      type: 'found',
      client_case_uuid: clientUuid,
      disaster_id: 'd0000000-0000-0000-0000-000000000001',
      consent_given: true,
      person: {
        full_name: form.full_name || 'Rescued Individual (Unidentified)',
        approximate_age: form.approximate_age ? parseInt(form.approximate_age) : null,
        gender: form.gender,
        description: `${form.description} [Rescued by ${form.rescue_unit} | Triage: ${form.triage_tag.toUpperCase()}]`,
        clothing_details: form.clothing_details || 'Field emergency foil blanket',
        physical_marks: form.physical_marks,
        last_seen_lat: form.rescue_lat,
        last_seen_lng: form.rescue_lng,
        last_seen_address: `${form.rescue_location_name} -> Transport to: ${form.transport_destination}`,
        last_seen_time: new Date().toISOString(),
        contact_person_name: `${form.rescue_unit} Dispatch Desk`,
        contact_phone: '+919876543299',
        contact_relationship: 'Rescue Team Officer',
        medical_notes: `Triage Tag: ${form.triage_tag.toUpperCase()}. Medical: ${form.medical_condition}`,
        is_vulnerable: form.is_vulnerable || form.triage_tag === 'red',
        vulnerability_reasons: ['rescued_disaster_victim', `triage_${form.triage_tag}`]
      }
    };

    if (!isOnline) {
      try {
        await saveReportOffline({
          clientCaseUuid: clientUuid,
          type: 'found',
          disasterId: payload.disaster_id,
          consentGiven: true,
          person: payload.person,
          photoBlob: form.photo_file,
          photoDataUrl: form.photo_preview,
          fileName: form.photo_file?.name || 'rescued-person.jpg',
          mimeType: form.photo_file?.type || 'image/jpeg',
        });
        setPendingCount(prev => prev + 1);
        alert('Offline Mode: Rescued individual registered locally in IndexedDB. Will sync automatically when connectivity returns.');
        setShowRegisterModal(false);
        setActionLoading(false);
        return;
      } catch (err) {
        alert('Could not save report locally: ' + err.message);
        setActionLoading(false);
        return;
      }
    }

    try {
      const res = await api.post('/cases', payload);
      const created = res.data;

      if (form.photo_file && created.id) {
        const photoData = new FormData();
        photoData.append('file', form.photo_file);
        photoData.append('is_primary', 'true');
        await api.post(`/cases/${created.id}/photos`, photoData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        }).catch(err => console.warn('Photo upload note:', err));
      }

      alert(`Rescued person registered successfully with Case Number: ${created.case_number}!`);
      setShowRegisterModal(false);
      setForm({
        full_name: '',
        approximate_age: '',
        gender: 'unknown',
        description: '',
        clothing_details: '',
        physical_marks: '',
        triage_tag: 'yellow',
        rescue_location_name: '',
        rescue_lat: 10.7685,
        rescue_lng: 79.8430,
        transport_destination: '',
        rescue_unit: '',
        medical_condition: '',
        is_vulnerable: false,
        photo_file: null,
        photo_preview: null,
      });
      fetchRescuedCases();
    } catch (err) {
      alert('Error registering rescued person: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (caseId, newStatus, noteText) => {
    setActionLoading(true);
    try {
      await api.patch(`/cases/${caseId}/status`, {
        status: newStatus,
        notes: `[Rescue Team Update] ${noteText}`
      });
      await fetchRescuedCases();
    } catch (err) {
      alert(`Could not update status: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter cases
  const filteredCases = cases.filter(c => {
    if (activeFilter === 'searching' && c.status !== 'searching' && c.status !== 'reported') return false;
    if (activeFilter === 'verified' && c.status !== 'verified' && c.status !== 'notified') return false;
    if (activeFilter === 'reunited' && c.status !== 'reunited' && c.status !== 'closed') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.person_name?.toLowerCase().includes(q);
      const matchNum = c.case_number?.toLowerCase().includes(q);
      const matchAddr = c.last_seen_address?.toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchAddr) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header Card */}
      <div className="card-white border-l-8 border-l-amber-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
              <Ambulance className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Rescue Team Operations Desk</h1>
              <p className="text-xs text-slate-500">
                Rapid field intake for flood, cyclone & disaster rescue squads. Register extracted victims & update transit status.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Register Rescued Person
          </button>
          <button
            onClick={fetchRescuedCases}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-slate-600 transition"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-white p-4 border-l-4 border-amber-500">
          <div className="text-xs font-bold text-slate-500 uppercase">Rescued Persons Registered</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{cases.length}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Total field extractions</div>
        </div>
        <div className="card-white p-4 border-l-4 border-blue-500">
          <div className="text-xs font-bold text-slate-500 uppercase">In Triage / Transit</div>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {cases.filter(c => c.status === 'reported' || c.status === 'searching').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active field movement</div>
        </div>
        <div className="card-white p-4 border-l-4 border-purple-500">
          <div className="text-xs font-bold text-slate-500 uppercase">Candidate Matched</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {cases.filter(c => c.status === 'candidate_found').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Linked to missing reports</div>
        </div>
        <div className="card-white p-4 border-l-4 border-emerald-500">
          <div className="text-xs font-bold text-slate-500 uppercase">Verified / Reunited</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {cases.filter(c => c.status === 'verified' || c.status === 'reunited' || c.status === 'closed').length}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Safely in care or family</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Search className="w-4 h-4 text-gray-400 ml-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rescued name, case #, or location..."
            className="text-xs outline-none w-full sm:w-64"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Rescued' },
            { id: 'searching', label: 'In Field / Transit' },
            { id: 'verified', label: 'Verified by HQ' },
            { id: 'reunited', label: 'Reunited' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeFilter === f.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rescued Cases Roster */}
      {loading ? (
        <div className="card-white text-center py-12 text-slate-500">Loading rescued roster...</div>
      ) : filteredCases.length === 0 ? (
        <div className="card-white text-center py-12 space-y-2">
          <Ambulance className="w-10 h-10 text-gray-300 mx-auto" />
          <div className="font-bold text-slate-700 text-sm">No rescued persons found for this filter</div>
          <p className="text-xs text-slate-400">Click "Register Rescued Person" above to record a new extraction.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCases.map(c => (
            <div key={c.id} className="card-white p-5 space-y-3 border-2 border-gray-100 hover:border-amber-400 transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg border border-amber-200">
                      {c.case_number}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      c.status === 'verified' || c.status === 'reunited'
                        ? 'bg-emerald-100 text-emerald-800'
                        : c.status === 'candidate_found'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-base mt-1.5">{c.person_name}</h3>
                </div>
                <div className="text-right text-xs text-slate-400">
                  {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span className="truncate">{c.last_seen_address || 'Nagapattinam Relief Corridor'}</span>
                </div>
                {c.approximate_age && (
                  <div><strong>Age:</strong> ~{c.approximate_age} yrs</div>
                )}
              </div>

              {/* Status Update Action Strip for Rescue Team */}
              <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-500">Update Transit / Triage:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(c.id, 'searching', 'Victim transported to Apex Hospital Emergency Ward')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
                  >
                    <Building2 className="w-3 h-3" /> To Hospital
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(c.id, 'searching', 'Victim safely sheltered at Camp Delta 3 Relief Shelter')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition flex items-center gap-1"
                  >
                    <Tent className="w-3 h-3" /> To Shelter
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Rescued Person Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Ambulance className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-black text-slate-900">Register Rescued Individual</h3>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterRescued} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Name / Responds to Name
                  </label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="e.g., Unidentified Boy or Appu"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estimated Age
                  </label>
                  <input
                    type="number"
                    value={form.approximate_age}
                    onChange={(e) => setForm({ ...form, approximate_age: e.target.value })}
                    placeholder="e.g., 8"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none bg-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Triage Urgency Tag <span className="text-brand-600">*</span>
                  </label>
                  <select
                    value={form.triage_tag}
                    onChange={(e) => setForm({ ...form, triage_tag: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-bold outline-none bg-white"
                  >
                    <option value="red" className="text-red-700">RED - Immediate (Critical Injury / Trauma)</option>
                    <option value="yellow" className="text-amber-700">YELLOW - Delayed (Moderate / Stable)</option>
                    <option value="green" className="text-emerald-700">GREEN - Minor (Walking Wounded / Dehydration)</option>
                    <option value="black" className="text-gray-700">BLACK - Deceased / Expectant</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rescue Extraction Point
                  </label>
                  <input
                    type="text"
                    value={form.rescue_location_name}
                    onChange={(e) => setForm({ ...form, rescue_location_name: e.target.value })}
                    placeholder="e.g., River Embankment Sector 4"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Transport Destination
                  </label>
                  <input
                    type="text"
                    value={form.transport_destination}
                    onChange={(e) => setForm({ ...form, transport_destination: e.target.value })}
                    placeholder="e.g., Apex Hospital or Camp Delta 3"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Clothing Details & Visible Marks
                </label>
                <input
                  type="text"
                  value={form.clothing_details}
                  onChange={(e) => setForm({ ...form, clothing_details: e.target.value })}
                  placeholder="e.g., Mud-stained yellow cartoon t-shirt, blue shorts, mark behind ear"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Medical Notes & Extraction Summary
                </label>
                <textarea
                  rows="2"
                  value={form.medical_condition}
                  onChange={(e) => setForm({ ...form, medical_condition: e.target.value })}
                  placeholder="e.g., Disoriented, mild hypothermia, first-aid administered on boat"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                />
              </div>

              {/* Photo Capture */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Field Photo (for instant AI face vector matching)
                </label>
                <PhotoCapture
                  onPhotoSelected={(file, previewUrl) => {
                    setForm({ ...form, photo_file: file, photo_preview: previewUrl });
                  }}
                  initialPreview={form.photo_preview}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition"
                >
                  {actionLoading ? 'Saving...' : 'Register & Queue for AI Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
