import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  HeartHandshake, 
  Search, 
  UserPlus, 
  ShieldCheck, 
  Radio, 
  ArrowRight, 
  Users, 
  Clock, 
  MapPin, 
  Activity, 
  CheckCircle2, 
  PhoneCall, 
  WifiOff 
} from 'lucide-react';
import api from '../api/client';
import { useNetwork } from '../context/NetworkContext';

export default function Landing() {
  const [stats, setStats] = useState({
    total_cases: 42,
    missing_cases: 28,
    found_cases: 14,
    reunited_count: 12,
    pending_verifications_count: 4,
    active_disasters_count: 1,
    vulnerable_minors_count: 9
  });
  const [trackerQuery, setTrackerQuery] = useState('');
  const { isOnline } = useNetwork();
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch live dashboard metrics
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(err => console.log('Using default situational stats:', err.message));
  }, []);

  const handleQuickTrack = (e) => {
    e.preventDefault();
    if (trackerQuery.trim()) {
      navigate(`/tracker?q=${encodeURIComponent(trackerQuery.trim())}`);
    }
  };

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-red-50 via-white to-gray-50 pt-12 pb-20 px-4 sm:px-6 lg:px-8 border-b border-red-100">
        <div className="max-w-7xl mx-auto text-center space-y-8">
          
          {/* Active Disaster Alert Pill */}
          <div className="inline-flex items-center gap-2 bg-white border-2 border-brand-600 px-4 py-1.5 rounded-full text-xs font-bold text-brand-700 shadow-emergency animate-pulse-subtle">
            <Radio className="w-4 h-4 text-brand-600 animate-pulse" />
            <span>DISASTER RESPONSE ACTIVE: CYCLONE VARDHA RELIEF ZONE</span>
          </div>

          {/* Headline */}
          <div className="space-y-4 max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-none">
              Reuniting Families Separated by <span className="text-brand-600 underline decoration-red-300 decoration-wavy">Disaster</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              When communications fail, <strong>REUNITE-X</strong> operates offline in relief camps, utilizes AI facial matching, and enforces human authority verification to safely reunite loved ones.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto pt-2">
            <Link
              to="/report-missing"
              className="btn-emergency w-full sm:w-auto text-lg py-4 px-8 shadow-emergency-lg hover:scale-105"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Report Missing Person
            </Link>
            <Link
              to="/report-found"
              className="btn-outline-emergency w-full sm:w-auto text-lg py-4 px-8 hover:scale-105"
            >
              <HeartHandshake className="w-5 h-5 mr-2" />
              Report Found Person
            </Link>
          </div>

          {/* Quick Case Tracker Search Bar */}
          <div className="max-w-xl mx-auto pt-6">
            <form onSubmit={handleQuickTrack} className="flex items-center bg-white rounded-2xl border-2 border-red-200 p-2 shadow-lg hover:border-brand-500 transition">
              <Search className="w-5 h-5 text-gray-400 ml-3 flex-shrink-0" />
              <input
                type="text"
                value={trackerQuery}
                onChange={(e) => setTrackerQuery(e.target.value)}
                placeholder="Track by Case Number (e.g., REX-2026-00001)..."
                className="w-full px-3 py-2 text-sm text-slate-900 outline-none"
              />
              <button
                type="submit"
                className="btn-emergency text-sm py-2 px-5 rounded-xl flex-shrink-0"
              >
                Track Status
              </button>
            </form>
          </div>

          {/* Offline Resilient Notice */}
          {!isOnline && (
            <div className="inline-flex items-center gap-2 bg-red-100 text-brand-800 text-xs font-bold px-4 py-2 rounded-xl border border-red-300">
              <WifiOff className="w-4 h-4 text-brand-600" />
              <span>Offline Mode Enabled. All reports will be saved locally to this device.</span>
            </div>
          )}
        </div>
      </section>

      {/* Real-Time Situational Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="card-white border-t-4 border-t-brand-600 text-center">
            <div className="text-3xl sm:text-4xl font-black text-brand-600">
              {stats.total_cases}
            </div>
            <div className="text-xs uppercase font-bold text-slate-500 mt-1">Total Reported Cases</div>
          </div>

          <div className="card-white border-t-4 border-t-emerald-600 text-center">
            <div className="text-3xl sm:text-4xl font-black text-emerald-600">
              {stats.reunited_count}
            </div>
            <div className="text-xs uppercase font-bold text-slate-500 mt-1">Confirmed Reunifications</div>
          </div>

          <div className="card-white border-t-4 border-t-amber-500 text-center">
            <div className="text-3xl sm:text-4xl font-black text-amber-600">
              {stats.pending_verifications_count}
            </div>
            <div className="text-xs uppercase font-bold text-slate-500 mt-1">Pending Authority Matches</div>
          </div>

          <div className="card-white border-t-4 border-t-red-800 text-center">
            <div className="text-3xl sm:text-4xl font-black text-red-800">
              {stats.vulnerable_minors_count}
            </div>
            <div className="text-xs uppercase font-bold text-slate-500 mt-1">Vulnerable Minors Shielded</div>
          </div>
        </div>
      </section>

      {/* How REUNITE-X Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <h2 className="text-3xl font-black text-slate-900">End-to-End Humanitarian Workflow</h2>
          <p className="text-sm text-slate-600">
            A secure, phased pipeline ensuring no case is lost during blackouts and no match is confirmed without official human verification.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="card-white relative">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-brand-700 font-black text-lg flex items-center justify-center mb-4">
              1
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Offline Intake</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Volunteers & families submit physical traits and camera photos. Operates without internet using local IndexedDB storage.
            </p>
          </div>

          {/* Step 2 */}
          <div className="card-white relative">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-brand-700 font-black text-lg flex items-center justify-center mb-4">
              2
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">AI Vector Matching</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              OpenCV aligns facial landmarks; pgvector runs 512-d cosine similarity blended with age, location, and clothing analysis.
            </p>
          </div>

          {/* Step 3 */}
          <div className="card-white relative border-2 border-brand-500 shadow-emergency">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white font-black text-lg flex items-center justify-center mb-4">
              3
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Human Authority Gate</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Zero auto-confirmations.</strong> Verified disaster officials inspect side-by-side evidence before approving matches.
            </p>
          </div>

          {/* Step 4 */}
          <div className="card-white relative">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-black text-lg flex items-center justify-center mb-4">
              4
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Safe Reunification</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              High-priority push & email alerts dispatched to family with protected contact instructions until custodial handover.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-brand-600 text-white rounded-3xl p-8 sm:p-12 shadow-emergency-lg flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h3 className="text-2xl sm:text-3xl font-black">Are You Searching for a Missing Family Member?</h3>
            <p className="text-red-100 text-sm">
              Submit a report immediately. Every report is matched continuously against relief shelters across the cyclone corridor.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/report-missing"
              className="bg-white text-brand-700 font-bold px-6 py-3.5 rounded-xl shadow hover:bg-red-50 transition text-sm flex items-center gap-2"
            >
              Start Report Now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
