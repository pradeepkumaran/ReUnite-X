import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  UserPlus, 
  Activity, 
  Stethoscope, 
  CheckCircle2, 
  AlertCircle, 
  HeartPulse, 
  RefreshCw, 
  Search, 
  FileText,
  MapPin,
  Bed,
  Sparkles
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { saveReportOffline } from '../db/indexedDB';
import PhotoCapture from '../components/common/PhotoCapture';

export default function HospitalDashboard() {
  const { user } = useAuth();
  const { isOnline, setPendingCount } = useNetwork();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);

  // Admission Form State
  const [form, setForm] = useState({
    full_name: '',
    approximate_age: '',
    gender: 'unknown',
    description: '',
    clothing_details: '',
    physical_marks: '',
    hospital_name: '',
    ward_id: '',
    attending_physician: '',
    clinical_condition: '',
    triage_priority: 'urgent', // critical, urgent, stable
    is_vulnerable: false,
    photo_file: null,
    photo_preview: null,
  });

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cases?case_type=found');
      setPatients(res.data);
    } catch (err) {
      console.warn('Hospital patients fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleAdmitPatient = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    const clientUuid = crypto.randomUUID();
    const payload = {
      type: 'found',
      client_case_uuid: clientUuid,
      disaster_id: 'd0000000-0000-0000-0000-000000000001',
      consent_given: true,
      person: {
        full_name: form.full_name || 'Hospital Admitted Patient (Unidentified)',
        approximate_age: form.approximate_age ? parseInt(form.approximate_age) : null,
        gender: form.gender,
        description: `${form.description} [Hospital: ${form.hospital_name} | Ward: ${form.ward_id} | Attending: ${form.attending_physician}]`,
        clothing_details: form.clothing_details || 'Hospital patient gown',
        physical_marks: form.physical_marks,
        last_seen_lat: 10.7656,
        last_seen_lng: 79.8424,
        last_seen_address: `${form.hospital_name}, Ward: ${form.ward_id}`,
        last_seen_time: new Date().toISOString(),
        contact_person_name: `${form.hospital_name} Helpdesk`,
        contact_phone: '+919876543222',
        contact_relationship: 'Hospital Administration',
        medical_notes: `Clinical Condition: ${form.clinical_condition}. Priority: ${form.triage_priority.toUpperCase()}. Dr: ${form.attending_physician}`,
        is_vulnerable: form.is_vulnerable,
        vulnerability_reasons: ['hospitalized_patient', `triage_${form.triage_priority}`]
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
          fileName: form.photo_file?.name || 'patient.jpg',
          mimeType: form.photo_file?.type || 'image/jpeg',
        });
        setPendingCount(prev => prev + 1);
        alert('Offline: Patient admission record saved in local database. Will automatically synchronize when online.');
        setShowAdmitModal(false);
        setActionLoading(false);
        return;
      } catch (err) {
        alert('Could not store record locally: ' + err.message);
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

      alert(`Disaster patient admitted & registered with Case Number: ${created.case_number}!`);
      setShowAdmitModal(false);
      setForm({
        full_name: '',
        approximate_age: '',
        gender: 'unknown',
        description: '',
        clothing_details: '',
        physical_marks: '',
        hospital_name: '',
        ward_id: '',
        attending_physician: '',
        clinical_condition: '',
        triage_priority: 'urgent',
        is_vulnerable: false,
        photo_file: null,
        photo_preview: null,
      });
    } catch (err) {
      console.warn('API error, saving admitted patient locally in Dexie IndexedDB:', err);
      try {
        await saveReportOffline({
          clientCaseUuid: clientUuid,
          type: 'found',
          disasterId: payload.disaster_id,
          consentGiven: true,
          person: payload.person,
          photoBlob: form.photo_file,
          photoDataUrl: form.photo_preview,
          fileName: form.photo_file?.name || 'patient-photo.jpg',
          mimeType: form.photo_file?.type || 'image/jpeg',
        });
        setPendingCount(prev => prev + 1);
        setPatients(prev => [
          {
            id: clientUuid,
            case_number: `OFFLINE-${clientUuid.slice(0, 8)}`,
            status: 'reported',
            person: payload.person,
            created_at: new Date().toISOString()
          },
          ...prev
        ]);
        alert(`Patient admitted & saved locally (Offline Mode). Case: OFFLINE-${clientUuid.slice(0, 8)}`);
        setShowAdmitModal(false);
        setForm({
          full_name: '',
          approximate_age: '',
          gender: 'unknown',
          description: '',
          clothing_details: '',
          physical_marks: '',
          hospital_name: '',
          ward_id: '',
          attending_physician: '',
          clinical_condition: '',
          triage_priority: 'urgent',
          is_vulnerable: false,
          photo_file: null,
          photo_preview: null,
        });
      } catch (storageErr) {
        alert('Could not save patient report locally: ' + storageErr.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateClinicalStatus = async (caseId, status, noteText) => {
    setActionLoading(true);
    try {
      await api.patch(`/cases/${caseId}/status`, {
        status: status,
        notes: `[Hospital Update] ${noteText}`
      });
      await fetchPatients();
      alert('Patient status updated successfully.');
    } catch (err) {
      alert(`Could not update status: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPatients = patients.filter(p => {
    if (statusFilter === 'active' && (p.status === 'reunited' || p.status === 'closed')) return false;
    if (statusFilter === 'reunited' && p.status !== 'reunited' && p.status !== 'closed') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.person_name?.toLowerCase().includes(q);
      const matchNum = p.case_number?.toLowerCase().includes(q);
      const matchAddr = p.last_seen_address?.toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchAddr) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner Card */}
      <div className="card-white border-l-8 border-l-blue-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
            <Building2 className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Hospital Medical & Patient Desk</h1>
            <p className="text-xs text-slate-500">
              Manage unidentified trauma admissions, update ward beds, record clinical progress & sync with central matching engine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdmitModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Admit & Register Patient
          </button>
          <button
            onClick={fetchPatients}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-slate-600 transition"
            title="Refresh Patient List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-white p-4 border-l-4 border-blue-600">
          <div className="text-xs font-bold text-slate-500 uppercase">Admitted Disaster Patients</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{patients.length}</div>
          <div className="text-[11px] text-blue-700 mt-0.5">Emergency admissions</div>
        </div>
        <div className="card-white p-4 border-l-4 border-amber-500">
          <div className="text-xs font-bold text-slate-500 uppercase">Under Treatment</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {patients.filter(p => p.status === 'reported' || p.status === 'searching').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">In recovery / ICU</div>
        </div>
        <div className="card-white p-4 border-l-4 border-purple-500">
          <div className="text-xs font-bold text-slate-500 uppercase">Family Link Identified</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {patients.filter(p => p.status === 'candidate_found' || p.status === 'verified').length}
          </div>
          <div className="text-[11px] text-purple-700 mt-0.5">AI matches under review</div>
        </div>
        <div className="card-white p-4 border-l-4 border-emerald-500">
          <div className="text-xs font-bold text-slate-500 uppercase">Reunited / Discharged</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {patients.filter(p => p.status === 'reunited' || p.status === 'closed').length}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Safe family custody</div>
        </div>
      </div>

      {/* Filter & Search Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Search className="w-4 h-4 text-gray-400 ml-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient name, case #, ward..."
            className="text-xs outline-none w-full sm:w-64"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Patients' },
            { id: 'active', label: 'Active Inpatients' },
            { id: 'reunited', label: 'Reunited / Discharged' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Patient List */}
      {loading ? (
        <div className="card-white text-center py-12 text-slate-500">Loading patients roster...</div>
      ) : filteredPatients.length === 0 ? (
        <div className="card-white text-center py-12 space-y-2">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto" />
          <div className="font-bold text-slate-700 text-sm">No hospital patient records found</div>
          <p className="text-xs text-slate-400">Click "Admit & Register Patient" to record an emergency patient.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPatients.map(p => (
            <div key={p.id} className="card-white p-5 space-y-3 border-2 border-gray-100 hover:border-blue-300 transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      {p.case_number}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      p.status === 'verified' || p.status === 'reunited'
                        ? 'bg-emerald-100 text-emerald-800'
                        : p.status === 'candidate_found'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-base mt-1.5">{p.person_name}</h3>
                </div>
                <div className="text-right text-xs text-slate-400">
                  {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span className="truncate">{p.last_seen_address || 'Apex Trauma Care Ward'}</span>
                </div>
                {p.approximate_age && (
                  <div><strong>Age:</strong> ~{p.approximate_age} yrs</div>
                )}
              </div>

              {/* Status Update Quick Buttons */}
              <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-500">Update Clinical Status:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateClinicalStatus(p.id, 'searching', 'Patient stabilized in General Recovery Ward Bed 4')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Mark Stable
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateClinicalStatus(p.id, 'searching', 'Patient transferred to Specialized Trauma Center')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
                  >
                    <Activity className="w-3 h-3" /> Transfer Ward
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admit Patient Modal */}
      {showAdmitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-black text-slate-900">Admit Disaster Patient</h3>
              </div>
              <button
                onClick={() => setShowAdmitModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdmitPatient} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Patient Name / Responds to
                  </label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="e.g., Unidentified Female Patient"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Approximate Age
                  </label>
                  <input
                    type="number"
                    value={form.approximate_age}
                    onChange={(e) => setForm({ ...form, approximate_age: e.target.value })}
                    placeholder="e.g., 35"
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
                    Clinical Priority
                  </label>
                  <select
                    value={form.triage_priority}
                    onChange={(e) => setForm({ ...form, triage_priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-bold outline-none bg-white"
                  >
                    <option value="critical">Critical (ICU / Emergency Surgery)</option>
                    <option value="urgent">Urgent (Trauma Ward / Fracture / Observation)</option>
                    <option value="stable">Stable (First Aid / Minor Cuts / Dehydration)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hospital Facility & Ward / Bed
                  </label>
                  <input
                    type="text"
                    value={form.ward_id}
                    onChange={(e) => setForm({ ...form, ward_id: e.target.value })}
                    placeholder="e.g., Trauma ICU - Bed 14"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Attending Physician / Doctor
                  </label>
                  <input
                    type="text"
                    value={form.attending_physician}
                    onChange={(e) => setForm({ ...form, attending_physician: e.target.value })}
                    placeholder="e.g., Dr. Priya Sundaram"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Physical Clothing & Distinctive Marks
                </label>
                <input
                  type="text"
                  value={form.physical_marks}
                  onChange={(e) => setForm({ ...form, physical_marks: e.target.value })}
                  placeholder="e.g., Tattoo on right forearm, small birthmark on forehead"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Clinical Diagnosis & Medical Observations
                </label>
                <textarea
                  rows="2"
                  value={form.clinical_condition}
                  onChange={(e) => setForm({ ...form, clinical_condition: e.target.value })}
                  placeholder="e.g., Compound fracture, receiving IV fluids and analgesics"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                />
              </div>

              {/* Photo */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Patient Photograph (Enables instant AI face matching against missing children & family queries)
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
                  onClick={() => setShowAdmitModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
                >
                  {actionLoading ? 'Admitting...' : 'Admit Patient & Run AI Face Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
