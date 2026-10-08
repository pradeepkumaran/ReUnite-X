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
  FileText
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AuthorityDashboard() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/matches');
      setMatches(res.data);
      if (res.data.length > 0 && !selectedMatch) {
        setSelectedMatch(res.data[0]);
      }
    } catch (err) {
      console.warn("Matches fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleVerify = async (matchId) => {
    if (!verificationNotes.trim()) {
      alert("Please provide official verification notes detailing visual confirmation justification.");
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/matches/${matchId}/verify`, {
        notes: verificationNotes,
        notify_family: true,
      });
      alert("Match officially VERIFIED. Case status updated and family notified.");
      setVerificationNotes('');
      fetchMatches();
    } catch (err) {
      alert("Error confirming verification: " + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (matchId) => {
    const reason = prompt("Enter reason for candidate rejection:");
    if (!reason) return;
    setActionLoading(true);
    try {
      await api.post(`/matches/${matchId}/reject`, { reason });
      alert("Match rejected. Cases reverted to searching.");
      fetchMatches();
    } catch (err) {
      alert("Error rejecting match: " + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 card-white border-l-8 border-l-brand-600">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-600" />
            <h1 className="text-2xl font-black text-slate-900">Disaster Authority Verification Queue</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Human-in-the-loop review station for official NDRF and relief officers. Zero cases are confirmed without your verified review.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-red-50 px-3.5 py-1.5 rounded-xl border border-red-200 text-xs font-bold text-brand-800">
          <span>Active Officer: {user?.full_name || 'Capt. Vikram Singh (NDRF)'}</span>
        </div>
      </div>

      {loading ? (
        <div className="card-white text-center py-16 text-slate-500">
          Loading AI Candidate Queue...
        </div>
      ) : matches.length === 0 ? (
        <div className="card-white text-center py-16 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">No Pending Candidate Matches</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All AI generated match pairs have been verified or rejected. The system continues evaluating incoming reports.
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
                      <span className="font-semibold text-brand-700">Missing: {m.missing_case?.person_name || 'Aarav Sharma'}</span>
                      <span className="text-slate-400">vs</span>
                      <span className="font-semibold text-emerald-700">Found: {m.found_case?.person_name || 'Boy (Appu)'}</span>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Face Cosine Sim: {(m.face_similarity * 100).toFixed(1)}%</span>
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
                      <img
                        src="https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80"
                        alt="Missing"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1 text-xs text-slate-800">
                      <div><strong>Name:</strong> {selectedMatch.missing_case?.person_name || 'Aarav Sharma'}</div>
                      <div><strong>Age:</strong> 8 years</div>
                      <div><strong>Clothing:</strong> Yellow cartoon t-shirt, blue denim shorts</div>
                      <div><strong>Marks:</strong> Small birthmark behind left ear</div>
                      <div><strong>Location:</strong> Old Bus Stand Evacuation Point</div>
                    </div>
                  </div>

                  {/* Right: Found Report */}
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="badge-found">Found Individual</span>
                      <span className="font-mono text-xs font-bold">{selectedMatch.found_case?.case_number || 'REX-2026-00002'}</span>
                    </div>

                    <div className="h-48 rounded-xl overflow-hidden bg-gray-200">
                      <img
                        src="https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80"
                        alt="Found"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1 text-xs text-slate-800">
                      <div><strong>Name:</strong> {selectedMatch.found_case?.person_name || 'Unidentified Boy (says Appu)'}</div>
                      <div><strong>Age:</strong> ~8 years</div>
                      <div><strong>Clothing:</strong> Mud-stained yellow t-shirt, blue shorts</div>
                      <div><strong>Marks:</strong> Small mark behind left ear</div>
                      <div><strong>Shelter:</strong> Camp Delta 3 Relief Shelter (0.8km away)</div>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Explanation */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
                  <span className="font-bold text-slate-800 uppercase tracking-wider block">
                    AI Multimodal Fusion Explanation:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-white p-2 rounded-lg border">
                      <div className="font-bold text-slate-500 text-[10px]">Face Cosine Sim</div>
                      <div className="text-sm font-black text-brand-600">{(selectedMatch.face_similarity * 100).toFixed(0)}%</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border">
                      <div className="font-bold text-slate-500 text-[10px]">Age / Gender</div>
                      <div className="text-sm font-black text-emerald-600">{(selectedMatch.age_gender_score * 100).toFixed(0)}%</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border">
                      <div className="font-bold text-slate-500 text-[10px]">Location Proximity</div>
                      <div className="text-sm font-black text-blue-600">{(selectedMatch.location_score * 100).toFixed(0)}%</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border">
                      <div className="font-bold text-slate-500 text-[10px]">Text Overlap</div>
                      <div className="text-sm font-black text-amber-600">{(selectedMatch.text_score * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>

                {/* Verification Actions */}
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <label className="block text-xs font-bold text-slate-800">
                    Official Verification Notes (Mandatory for Audit Trail) <span className="text-brand-600">*</span>
                  </label>
                  <textarea
                    rows="3"
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Enter official officer verification rationale (e.g. Visual inspection of physical birthmark behind left ear matches family photos)..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 text-xs outline-none"
                  />

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleReject(selectedMatch.id)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 transition flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> Reject Match
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading || !verificationNotes.trim()}
                      onClick={() => handleVerify(selectedMatch.id)}
                      className="btn-emergency text-xs py-2.5 px-6 flex items-center gap-1.5"
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
    </div>
  );
}
