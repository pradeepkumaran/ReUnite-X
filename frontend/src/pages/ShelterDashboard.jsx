import React, { useState, useEffect } from 'react';
import { 
  Tent, 
  UserPlus, 
  MapPin, 
  Users, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  Home, 
  Building,
  Heart,
  ArrowRight,
  ShieldCheck,
  Package
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { saveReportOffline } from '../db/indexedDB';
import PhotoCapture from '../components/common/PhotoCapture';

export default function ShelterDashboard() {
  const { user } = useAuth();
  const { isOnline, setPendingCount } = useNetwork();
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);

  // Shelter Intake State
  const [form, setForm] = useState({
    full_name: '',
    approximate_age: '',
    gender: 'unknown',
    description: '',
    clothing_details: '',
    physical_marks: '',
    shelter_facility: '',
    tent_block_id: '',
    camp_officer: '',
    special_needs: '',
    contact_phone: '',
    is_vulnerable: false,
    photo_file: null,
    photo_preview: null,
  });

  const fetchResidents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cases?case_type=found');
      setResidents(res.data);
    } catch (err) {
      console.warn('Shelter fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidents();
  }, []);

  const handleRegisterResident = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    const clientUuid = crypto.randomUUID();
    const payload = {
      type: 'found',
      client_case_uuid: clientUuid,
      disaster_id: 'd0000000-0000-0000-0000-000000000001',
      consent_given: true,
      person: {
        full_name: form.full_name || 'Shelter Resident (Unidentified)',
        approximate_age: form.approximate_age ? parseInt(form.approximate_age) : null,
        gender: form.gender,
        description: `${form.description} [Shelter: ${form.shelter_facility} | Tent: ${form.tent_block_id} | In-Charge: ${form.camp_officer}]`,
        clothing_details: form.clothing_details || 'Relief camp clothing kit',
        physical_marks: form.physical_marks,
        last_seen_lat: 10.7712,
        last_seen_lng: 79.8450,
        last_seen_address: `${form.shelter_facility}, ${form.tent_block_id}`,
        last_seen_time: new Date().toISOString(),
        contact_person_name: `${form.shelter_facility} Control Desk`,
        contact_phone: form.contact_phone,
        contact_relationship: 'Camp Administration',
        medical_notes: `Special Needs: ${form.special_needs}`,
        is_vulnerable: form.is_vulnerable,
        vulnerability_reasons: ['displaced_shelter_resident']
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
          fileName: form.photo_file?.name || 'shelter-resident.jpg',
          mimeType: form.photo_file?.type || 'image/jpeg',
        });
        setPendingCount(prev => prev + 1);
        alert('Offline: Resident registered locally. Will sync to central registry when connection is restored.');
        setShowIntakeModal(false);
        setActionLoading(false);
        return;
      } catch (err) {
        alert('Could not store locally: ' + err.message);
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
        }).catch(err => console.warn('Photo note:', err));
      }

      alert(`Resident registered in shelter registry with Case Number: ${created.case_number}!`);
      setShowIntakeModal(false);
      setForm({
        full_name: '',
        approximate_age: '',
        gender: 'unknown',
        description: '',
        clothing_details: '',
        physical_marks: '',
        shelter_facility: '',
        tent_block_id: '',
        camp_officer: '',
        special_needs: '',
        contact_phone: '',
        is_vulnerable: false,
        photo_file: null,
        photo_preview: null,
      });
      fetchResidents();
    } catch (err) {
      alert('Error registering resident: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateLocation = async (caseId, currentAddress) => {
    const newLocation = prompt('Enter updated shelter location / tent assignment:', currentAddress || 'Camp Delta Sector C Tent 12');
    if (!newLocation) return;

    setActionLoading(true);
    try {
      await api.patch(`/cases/${caseId}/status`, {
        status: 'searching',
        notes: `[Shelter Location Updated] Relocated to: ${newLocation}`
      });
      await fetchResidents();
      alert(`Location updated to: ${newLocation}`);
    } catch (err) {
      alert(`Could not update location: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredResidents = residents.filter(r => {
    if (filter === 'reunited' && r.status !== 'reunited' && r.status !== 'closed') return false;
    if (filter === 'active' && (r.status === 'reunited' || r.status === 'closed')) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.person_name?.toLowerCase().includes(q);
      const matchNum = r.case_number?.toLowerCase().includes(q);
      const matchAddr = r.last_seen_address?.toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchAddr) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner Card */}
      <div className="card-white border-l-8 border-l-emerald-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
            <Tent className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Shelter & Relief Camp Coordination</h1>
            <p className="text-xs text-slate-500">
              Displaced person intake, family unit grouping, tent/block assignment, and location updates for emergency camps.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowIntakeModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Shelter Person Intake
          </button>
          <button
            onClick={fetchResidents}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-slate-600 transition"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-white p-4 border-l-4 border-emerald-600">
          <div className="text-xs font-bold text-slate-500 uppercase">Current Camp Population</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{residents.length}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Displaced individuals housed</div>
        </div>
        <div className="card-white p-4 border-l-4 border-amber-500">
          <div className="text-xs font-bold text-slate-500 uppercase">Active Sheltered</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {residents.filter(r => r.status === 'reported' || r.status === 'searching').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Awaiting family reunification</div>
        </div>
        <div className="card-white p-4 border-l-4 border-purple-500">
          <div className="text-xs font-bold text-slate-500 uppercase">Matches in Review</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {residents.filter(r => r.status === 'candidate_found' || r.status === 'verified').length}
          </div>
          <div className="text-[11px] text-purple-700 mt-0.5">Potential family links</div>
        </div>
        <div className="card-white p-4 border-l-4 border-blue-500">
          <div className="text-xs font-bold text-slate-500 uppercase">Reunified with Family</div>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {residents.filter(r => r.status === 'reunited' || r.status === 'closed').length}
          </div>
          <div className="text-[11px] text-blue-700 mt-0.5">Safely returned home</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Search className="w-4 h-4 text-gray-400 ml-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resident name, tent, or case #..."
            className="text-xs outline-none w-full sm:w-64"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Residents' },
            { id: 'active', label: 'Currently Sheltered' },
            { id: 'reunited', label: 'Reunited' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                filter === f.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resident Cards Grid */}
      {loading ? (
        <div className="card-white text-center py-12 text-slate-500">Loading shelter roster...</div>
      ) : filteredResidents.length === 0 ? (
        <div className="card-white text-center py-12 space-y-2">
          <Tent className="w-10 h-10 text-gray-300 mx-auto" />
          <div className="font-bold text-slate-700 text-sm">No residents found in this view</div>
          <p className="text-xs text-slate-400">Click "Shelter Person Intake" to register new arrivals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResidents.map(r => (
            <div key={r.id} className="card-white p-5 space-y-3 border-2 border-gray-100 hover:border-emerald-300 transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                      {r.case_number}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      r.status === 'verified' || r.status === 'reunited'
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.status === 'candidate_found'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-base mt-1.5">{r.person_name}</h3>
                </div>
                <div className="text-right text-xs text-slate-400">
                  {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="truncate">{r.last_seen_address || 'Camp Delta 3 Relief Shelter'}</span>
                </div>
                {r.approximate_age && (
                  <div><strong>Age:</strong> ~{r.approximate_age} yrs</div>
                )}
              </div>

              {/* Location Update Button for Shelter Officer */}
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">Location Management:</span>
                <button
                  disabled={actionLoading}
                  onClick={() => handleUpdateLocation(r.id, r.last_seen_address)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Update Camp / Tent Location
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Intake Modal */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Tent className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-black text-slate-900">Shelter Resident Intake Registration</h3>
              </div>
              <button
                onClick={() => setShowIntakeModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterResident} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Resident Full Name
                  </label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="e.g., Unidentified Displaced Person"
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
                    placeholder="e.g., 28"
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
                    Shelter Facility Name
                  </label>
                  <input
                    type="text"
                    value={form.shelter_facility}
                    onChange={(e) => setForm({ ...form, shelter_facility: e.target.value })}
                    placeholder="e.g., Camp Delta 3 Relief Shelter"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Tent / Block ID
                  </label>
                  <input
                    type="text"
                    value={form.tent_block_id}
                    onChange={(e) => setForm({ ...form, tent_block_id: e.target.value })}
                    placeholder="e.g., Sector B - Tent 09"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shelter Desk Officer Phone
                  </label>
                  <input
                    type="tel"
                    value={form.contact_phone}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                    placeholder="+91 98765 43211"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Special Relief Needs (Food, Medical, Pediatric, Geriatric)
                </label>
                <input
                  type="text"
                  value={form.special_needs}
                  onChange={(e) => setForm({ ...form, special_needs: e.target.value })}
                  placeholder="e.g., Diapers, insulin cooler, high-calorie meal pack"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Clothing & Physical Marks
                </label>
                <input
                  type="text"
                  value={form.clothing_details}
                  onChange={(e) => setForm({ ...form, clothing_details: e.target.value })}
                  placeholder="e.g., Blue shirt, spectacles, speaks Tamil"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                />
              </div>

              {/* Photo */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Resident Photograph (Cross-matched with central database)
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
                  onClick={() => setShowIntakeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                >
                  {actionLoading ? 'Saving...' : 'Register in Shelter Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
