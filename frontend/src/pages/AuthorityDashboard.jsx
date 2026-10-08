import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  User, 
  MapPin, 
  Sparkles, 
  ArrowRight,
  Eye,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Bell,
  Clock,
  Layers,
  Copy
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AuthorityDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'cases', 'reunifications'
  const [matches, setMatches] = useState([]);
  const [allCases, setAllCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verifiedLocationName, setVerifiedLocationName] = useState('Camp Delta 3 Medical Ward');
  const [verifiedLat, setVerifiedLat] = useState(10.7712);
  const [verifiedLng, setVerifiedLng] = useState(79.8450);
  const [actionLoading, setActionLoading] = useState(false);
  const [caseFilter, setCaseFilter] = useState('all');
  const [caseSearch, setCaseSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [matchesRes, casesRes] = await Promise.all([
        api.get('/matches').catch(() => ({ data: [] })),
        api.get('/cases').catch(() => ({ data: [] }))
      ]);
      setMatches(matchesRes.data || []);
      setAllCases(casesRes.data || []);
      if (matchesRes.data?.length > 0 && !selectedMatch) {
        setSelectedMatch(matchesRes.data[0]);
      }
    } catch (err) {
      console.warn("Authority data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateCaseStatus = async (caseId, targetStatus, noteText) => {
    setActionLoading(true);
    try {
      await api.patch(`/cases/${caseId}/status`, {
        status: targetStatus,
        notes: noteText || `Authority action by ${user?.full_name || 'NDRF Officer'}`
      });
      await fetchData();
      alert(`Case status updated to '${targetStatus}'.`);
    } catch (err) {
      alert(`Could not update status: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async (matchId) => {
    if (!verificationNotes.trim()) {
      alert("Please provide official verification notes detailing visual confirmation justification.");
      return;
    }
    setActionLoading(true);
    try {
      const response = await api.post(`/matches/${matchId}/verify`, {
        notes: verificationNotes,
        verified_location_lat: verifiedLat,
        verified_location_lng: verifiedLng,
        verified_location_name: verifiedLocationName,
        notify_family: true,
      });

      alert(response.data.family_notified
        ? "Match verified! High-priority notification dispatched to family."
        : "Match verified by Authority! Status updated to VERIFIED. Location confirmed.");
      setVerificationNotes('');
      await fetchData();
    } catch (err) {
      alert("Error confirming verification: " + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (matchId) => {
    const reason = prompt("Enter official reason for candidate rejection:");
    if (!reason) return;
    setActionLoading(true);
    try {
      await api.post(`/matches/${matchId}/reject`, { reason });
      alert("Match candidate rejected. Both cases reverted to searching loop.");
      await fetchData();
    } catch (err) {
      alert("Error rejecting match: " + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const followups = allCases.filter(item =>
    ['verified', 'notified', 'reunited'].includes(item.status)
  );

  const filteredCases = allCases.filter(c => {
    if (caseFilter !== 'all' && c.status !== caseFilter) return false;
    if (caseSearch.trim()) {
      const q = caseSearch.toLowerCase();
      const matchName = c.person_name?.toLowerCase().includes(q);
      const matchNum = c.case_number?.toLowerCase().includes(q);
      const matchAddr = c.last_seen_address?.toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchAddr) return false;
    }
    return true;
  });

  const missingCase = selectedMatch?.missing_case_details;
  const foundCase = selectedMatch?.found_case_details;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 card-white border-l-8 border-l-brand-600">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-600" />
            <h1 className="text-2xl font-black text-slate-900">Disaster Authority Command & Verification HQ</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Human-in-the-loop review station for official NDRF and relief officers. Zero cases are confirmed without verified review.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="bg-red-50 px-3.5 py-1.5 rounded-xl border border-red-200 text-xs font-bold text-brand-800">
            <span>Officer: {user?.full_name || 'Capt. Vikram Singh (NDRF)'}</span>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-slate-600 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
            activeTab === 'queue'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI Verification Queue ({matches.length})
        </button>
        <button
          onClick={() => setActiveTab('cases')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
            activeTab === 'cases'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Manage All Cases ({allCases.length})
        </button>
        <button
          onClick={() => setActiveTab('reunifications')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
            activeTab === 'reunifications'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Reunification Follow-ups ({followups.length})
        </button>
      </div>

      {/* TAB 1: AI CANDIDATE VERIFICATION QUEUE */}
      {activeTab === 'queue' && (
        <>
          {loading ? (
            <div className="card-white text-center py-16 text-slate-500">
              Loading AI Candidate Queue...
            </div>
          ) : matches.length === 0 ? (
            <div className="card-white text-center py-16 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">No Pending Candidate Matches</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All AI generated match pairs have been verified or rejected. The system continues evaluating incoming reports in background.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Candidates List Column */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                  Candidate Queue ({matches.length})
                </h3>
                <div className="space-y-2">
                  {matches.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMatch(m)}
                      className={`card-white p-4 cursor-pointer transition border-2 ${
                        selectedMatch?.id === m.id
                          ? 'border-brand-600 bg-red-50/30 shadow-emergency'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-500">
                          Match Score: <strong className="text-brand-600 text-sm">{m.match_score.toFixed(1)}%</strong>
                        </span>
                        <span className="bg-red-100 text-brand-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                          Priority {m.priority_score.toFixed(0)}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-brand-700">Missing: {m.missing_case?.person_name || 'Unknown'}</span>
                          <span className="text-slate-400">vs</span>
                          <span className="font-semibold text-emerald-700">Found: {m.found_case?.person_name || 'Unknown'}</span>
                        </div>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>
                          Face cosine: {m.score_explanation?.face_signal_available !== false
                            ? `${(m.face_similarity * 100).toFixed(1)}%`
                            : 'unavailable'}
                        </span>
                        <span className="font-bold text-slate-700">{m.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Candidate Detailed Inspection & Verification (2 cols) */}
              {selectedMatch && (
                <div className="lg:col-span-2 space-y-6">
                  <div className="card-white space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">Side-by-Side Candidate Dossier</h3>
                        <p className="text-xs text-slate-500">Compare physical markers, clothing details, and facial photos</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-500 block">Blended Confidence:</span>
                        <span className="text-xl font-black text-brand-600">{selectedMatch.match_score.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Side-by-Side Comparison Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Left: Missing Report */}
                      <div className="p-4 rounded-xl border border-red-200 bg-red-50/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="badge-missing">Missing Person</span>
                          <span className="font-mono text-xs font-bold">{selectedMatch.missing_case?.case_number || 'REX-2026-00001'}</span>
                        </div>

                        <div className="h-48 rounded-xl overflow-hidden bg-gray-200">
                          {missingCase?.photos?.find((photo) => photo.is_primary)?.signed_url ? (
                            <img
                              src={missingCase.photos.find((photo) => photo.is_primary).signed_url}
                              alt="Missing person report photo"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-slate-500">
                              Photo registered on case dossier
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 text-xs text-slate-800">
                          <div><strong>Name:</strong> {missingCase?.person.full_name || 'Unknown'}</div>
                          <div><strong>Age:</strong> {missingCase?.person.approximate_age ?? 'Unknown'}</div>
                          <div><strong>Clothing:</strong> {missingCase?.person.clothing_details || 'Not provided'}</div>
                          <div><strong>Marks:</strong> {missingCase?.person.physical_marks || 'Not provided'}</div>
                          <div><strong>Location:</strong> {missingCase?.person.last_seen_address || 'Not provided'}</div>
                          <div><strong>Medical notes:</strong> {missingCase?.person.medical_notes || 'None provided'}</div>
                        </div>
                      </div>

                      {/* Right: Found Report */}
                      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="badge-found">Found / Rescued Person</span>
                          <span className="font-mono text-xs font-bold">{selectedMatch.found_case?.case_number || 'REX-2026-00002'}</span>
                        </div>

                        <div className="h-48 rounded-xl overflow-hidden bg-gray-200">
                          {foundCase?.photos?.find((photo) => photo.is_primary)?.signed_url ? (
                            <img
                              src={foundCase.photos.find((photo) => photo.is_primary).signed_url}
                              alt="Found person report photo"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-slate-500">
                              Photo registered on case dossier
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 text-xs text-slate-800">
                          <div><strong>Name:</strong> {foundCase?.person.full_name || 'Unidentified person'}</div>
                          <div><strong>Age:</strong> {foundCase?.person.approximate_age ?? 'Unknown'}</div>
                          <div><strong>Clothing:</strong> {foundCase?.person.clothing_details || 'Not provided'}</div>
                          <div><strong>Marks:</strong> {foundCase?.person.physical_marks || 'Not provided'}</div>
                          <div><strong>Location:</strong> {foundCase?.person.last_seen_address || 'Not provided'}</div>
                          <div><strong>Medical notes:</strong> {foundCase?.person.medical_notes || 'None provided'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Score Breakdown Explanation */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 text-xs">
                      <span className="font-bold text-slate-800 uppercase tracking-wider block">
                        AI Multimodal Fusion Explanation:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="bg-white p-2.5 rounded-lg border">
                          <div className="font-bold text-slate-500 text-[10px]">Face Cosine Sim (60%)</div>
                          <div className="text-base font-black text-brand-600">
                            {(selectedMatch.face_similarity * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border">
                          <div className="font-bold text-slate-500 text-[10px]">Demographics (15%)</div>
                          <div className="text-base font-black text-emerald-600">{(selectedMatch.age_gender_score * 100).toFixed(0)}%</div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border">
                          <div className="font-bold text-slate-500 text-[10px]">Location Proximity (15%)</div>
                          <div className="text-base font-black text-blue-600">{(selectedMatch.location_score * 100).toFixed(0)}%</div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border">
                          <div className="font-bold text-slate-500 text-[10px]">Text Overlap (10%)</div>
                          <div className="text-base font-black text-amber-600">{(selectedMatch.text_score * 100).toFixed(0)}%</div>
                        </div>
                      </div>
                    </div>

                    {/* Verification Form: Notes + Confirmed Location */}
                    <div className="border-t border-gray-100 pt-4 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Official Verification Notes (Mandatory for Audit Trail) <span className="text-brand-600">*</span>
                        </label>
                        <textarea
                          rows="2"
                          value={verificationNotes}
                          onChange={(e) => setVerificationNotes(e.target.value)}
                          placeholder="Enter official officer verification rationale (e.g. Visual confirmation of birthmark behind left ear matching family records)..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 text-xs outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Confirmed Shelter Location Name
                          </label>
                          <input
                            type="text"
                            value={verifiedLocationName}
                            onChange={(e) => setVerifiedLocationName(e.target.value)}
                            placeholder="e.g., Camp Delta 3 Medical Ward"
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Confirmed Lat</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={verifiedLat}
                            onChange={(e) => setVerifiedLat(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Confirmed Lng</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={verifiedLng}
                            onChange={(e) => setVerifiedLng(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleReject(selectedMatch.id)}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" /> Reject Candidate
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading || !verificationNotes.trim()}
                          onClick={() => handleVerify(selectedMatch.id)}
                          className="btn-emergency text-xs py-2.5 px-6 flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Confirm Verification & Alert Family
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB 2: MANAGE ALL CASES */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-gray-400 ml-2" />
              <input
                type="text"
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
                placeholder="Search case #, person name, location..."
                className="text-xs outline-none w-full sm:w-64"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {[
                { id: 'all', label: 'All Cases' },
                { id: 'reported', label: 'Reported' },
                { id: 'searching', label: 'Searching' },
                { id: 'candidate_found', label: 'Candidate Found' },
                { id: 'verified', label: 'Verified' },
                { id: 'reunited', label: 'Reunited' },
                { id: 'closed', label: 'Closed' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setCaseFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    caseFilter === f.id
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCases.map(item => (
              <div key={item.id} className="card-white p-5 space-y-3 border-2 border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded-lg">
                        {item.case_number}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        item.type === 'missing' ? 'badge-missing' : 'badge-found'
                      }`}>
                        {item.type}
                      </span>
                      {item.is_minor && <span className="badge-minor">Minor</span>}
                    </div>
                    <h4 className="font-black text-slate-900 text-base mt-1">{item.person_name}</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 uppercase">
                    {item.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-600" />
                    <span>{item.last_seen_address || 'Nagapattinam Disaster Zone'}</span>
                  </div>
                  {item.approximate_age && <div>Age: ~{item.approximate_age} yrs</div>}
                </div>

                <div className="border-t pt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Created: {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCaseStatus(item.id, 'searching', 'Authority manually initiated priority search loop')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 hover:bg-gray-200 text-slate-700"
                    >
                      Set Searching
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: REUNIFICATION FOLLOW-UPS */}
      {activeTab === 'reunifications' && (
        <section className="card-white space-y-4">
          <div>
            <h2 className="font-black text-slate-900 text-base">Reunification & Case Closure Workstation</h2>
            <p className="text-xs text-slate-600">
              Only verified disaster authorities can advance verified cases to reunited and close them with archival in the audit log.
            </p>
          </div>

          {followups.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No verified cases currently awaiting reunification follow-up.
            </div>
          ) : followups.map(item => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-4">
              <div>
                <p className="font-black text-slate-900">{item.case_number} · {item.person_name}</p>
                <p className="text-xs text-slate-500 capitalize">{item.type} · Current Status: <strong className="text-brand-700">{item.status.replace('_', ' ')}</strong></p>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.last_seen_address || 'Nagapattinam Shelter Corridor'}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.status === 'reunited' ? (
                  <button
                    disabled={actionLoading}
                    onClick={() => updateCaseStatus(item.id, 'closed', 'Official final closure with physical family custody verified')}
                    className="btn-outline-emergency text-xs py-2 px-4"
                  >
                    Archive & Close Case
                  </button>
                ) : (
                  <button
                    disabled={actionLoading}
                    onClick={() => updateCaseStatus(item.id, 'reunited', 'Authority confirmed physical handover to verified family custody')}
                    className="btn-emergency text-xs py-2 px-4"
                  >
                    Confirm Reunited
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
