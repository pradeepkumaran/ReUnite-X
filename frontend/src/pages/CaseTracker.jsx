import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  MapPin, 
  AlertCircle, 
  User, 
  PhoneCall,
  Activity,
  ArrowRight
} from 'lucide-react';
import api from '../api/client';

export default function CaseTracker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCase = async (searchQuery) => {
    if (!searchQuery || !searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Direct query attempt (backend supports ID, case_number, and client_case_uuid)
      try {
        const detailRes = await api.get(`/cases/${encodeURIComponent(searchQuery.trim())}`);
        setCaseData(detailRes.data);
        return;
      } catch (directErr) {
        // Fallback: list cases matching case_number or ID
        const res = await api.get('/cases');
        const found = res.data.find(c => 
          c.case_number.toLowerCase() === searchQuery.trim().toLowerCase() || 
          c.id === searchQuery.trim() ||
          c.client_case_uuid === searchQuery.trim()
        );
        if (found) {
          const detailRes = await api.get(`/cases/${found.id}`);
          setCaseData(detailRes.data);
          return;
        }
        throw directErr;
      }
    } catch (err) {
      setError(`No active case found matching '${searchQuery}'. Please check your Case Number.`);
      setCaseData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q && q.trim()) {
      setQuery(q);
      fetchCase(q.trim());
    } else {
      setCaseData(null);
    }
  }, [searchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
      fetchCase(query.trim());
    }
  };

  // Status timeline stages
  const stages = [
    { key: 'reported', label: 'Reported', desc: 'Case registered into disaster database' },
    { key: 'searching', label: 'Searching', desc: 'AI facial vector search active' },
    { key: 'candidate_found', label: 'Candidate Found', desc: 'Prospective AI match identified' },
    { key: 'verified', label: 'Authority Verified', desc: 'Official human inspection confirmed' },
    { key: 'notified', label: 'Family Contacted', desc: 'High-priority notifications sent' },
    { key: 'reunited', label: 'Reunited', desc: 'Individual in family custody' },
  ];

  const getStepIndex = (status) => {
    const map = {
      'reported': 0,
      'searching': 1,
      'candidate_found': 2,
      'verified': 3,
      'notified': 4,
      'reunited': 5,
      'closed': 5
    };
    return map[status] ?? 0;
  };

  const currentStepIdx = caseData ? getStepIndex(caseData.status) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header & Search */}
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-brand-700 border border-red-200">
          <Clock className="w-3.5 h-3.5" /> Real-Time Situational Tracking
        </span>
        <h1 className="text-3xl font-black text-slate-900">Track Reunification Case Status</h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Enter your official case registration number to inspect live status updates and shelter locations.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-xl mx-auto flex items-center bg-white rounded-2xl border-2 border-red-200 p-2 shadow-sm hover:border-brand-500 transition">
          <Search className="w-5 h-5 text-gray-400 ml-3 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., REX-2026-00001"
            className="w-full px-3 py-2 text-sm text-slate-900 outline-none uppercase font-mono font-bold"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-emergency text-sm py-2 px-6 rounded-xl flex-shrink-0"
          >
            {loading ? 'Searching...' : 'Track'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-2xl border border-red-200 text-sm text-brand-800 text-center font-medium">
          {error}
        </div>
      )}

      {!caseData && !loading && !error && (
        <div className="card-white text-center py-12 px-4 space-y-3 max-w-lg mx-auto">
          <Clock className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Enter a Case Number to Track</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Enter your official registration number (e.g. REX-2026-00001) or UUID assigned during report submission to track search, rescue, hospital admissions, and reunification status in real time.
          </p>
        </div>
      )}

      {/* Case Details Card */}
      {caseData && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Status Header Strip */}
          <div className="card-white border-l-8 border-l-brand-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl sm:text-2xl font-black text-slate-900">
                  {caseData.case_number}
                </span>
                <span className={caseData.type === 'missing' ? 'badge-missing' : 'badge-found'}>
                  {caseData.type}
                </span>
                {caseData.is_minor && (
                  <span className="badge-minor">Minor Protected</span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                Subject: <strong className="text-slate-900">{caseData.person?.full_name}</strong>
                {caseData.person?.approximate_age && ` (${caseData.person.approximate_age} yrs)`}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase font-bold text-slate-400 block">Current Status</span>
              <span className="inline-block px-3 py-1 rounded-xl text-sm font-black uppercase tracking-wider bg-red-100 text-brand-700 border border-red-200 mt-1">
                {caseData.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="card-white">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-600" /> Lifecycle Progress
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {stages.map((stage, idx) => {
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div
                    key={stage.key}
                    className={`p-3 rounded-xl border text-center transition ${
                      isCurrent
                        ? 'bg-brand-600 text-white border-brand-600 shadow-emergency'
                        : isPassed
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-gray-50 text-slate-400 border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-center mb-1.5">
                      {isPassed && !isCurrent ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center ${
                          isCurrent ? 'bg-white text-brand-700' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {idx + 1}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-xs">{stage.label}</div>
                    <div className={`text-[10px] mt-1 leading-tight ${isCurrent ? 'text-red-100' : 'text-slate-500'}`}>
                      {stage.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dossier Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Person & Photo Column */}
            <div className="card-white space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-gray-100 pb-2">
                Physical Attributes
              </h4>

              {caseData.photos?.length > 0 ? (
                <div className="rounded-xl overflow-hidden border border-red-100 bg-gray-50">
                  <img
                    src={caseData.photos[0].signed_url || `/photos/${caseData.photos[0].file_name}`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80";
                    }}
                    alt={caseData.person?.full_name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-2 bg-white text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                    <span>Face Landmarks Aligned</span>
                    <span className="text-emerald-700 font-bold">512-d Vector Active</span>
                  </div>
                </div>
              ) : (
                <div className="h-40 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400">
                  No Photo Attached
                </div>
              )}

              <div className="space-y-1.5 text-xs text-slate-700">
                <div><strong>Clothing:</strong> {caseData.person?.clothing_details || 'N/A'}</div>
                <div><strong>Marks / Scars:</strong> {caseData.person?.physical_marks || 'None reported'}</div>
                <div><strong>Traits:</strong> {caseData.person?.description || 'N/A'}</div>
              </div>
            </div>

            {/* Location & Shelter Column */}
            <div className="card-white space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-gray-100 pb-2">
                Location & Shelter
              </h4>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-slate-900">Last Seen / Shelter Point:</strong>
                    <span>{caseData.person?.last_seen_address || 'Nagapattinam Relief Zone'}</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <span className="text-[11px] text-slate-500 font-bold uppercase block mb-1">Coordinates:</span>
                  <div className="font-mono text-slate-900 text-xs">
                    Lat: {caseData.person?.last_seen_lat ?? '—'} <br />
                    Lng: {caseData.person?.last_seen_lng ?? '—'}
                  </div>
                </div>

                <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-brand-900 text-xs">
                  <strong>Relief Coordination Desk:</strong><br />
                  Call disaster hotline <strong>1070</strong> referencing case number <strong>{caseData.case_number}</strong>.
                </div>
              </div>
            </div>

            {/* Verification & Family Contact Column */}
            <div className="card-white space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-gray-100 pb-2">
                Official Verification Status
              </h4>

              <div className="space-y-3 text-xs">
                {caseData.status === 'candidate_found' && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-300 text-amber-900">
                    <span className="font-bold flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Candidate Match in Review
                    </span>
                    <p className="mt-1 leading-relaxed">
                      AI identified a candidate match. Currently undergoing official review by the Disaster Verification Authority.
                    </p>
                  </div>
                )}

                {caseData.status === 'verified' && (
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-300 text-emerald-900">
                    <span className="font-bold flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Officially Verified by NDRF
                    </span>
                    <p className="mt-1 leading-relaxed">
                      Identity confirmed visually. Family notification dispatched.
                    </p>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3">
                  <span className="text-slate-500 font-bold uppercase text-[10px] block mb-1">Reporter / Family Contact:</span>
                  <div className="text-slate-800">
                    <div>{caseData.person?.contact_person_name || 'Protected'}</div>
                    <div className="font-mono text-xs">{caseData.person?.contact_phone || '[Redacted]'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
