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
  WifiOff,
  Ambulance,
  Building2,
  Tent,
  Layers,
  Sparkles,
  ArrowDown
} from 'lucide-react';
import api from '../api/client';
import { useNetwork } from '../context/NetworkContext';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const [stats, setStats] = useState({
    total_cases: 0,
    missing_cases: 0,
    found_cases: 0,
    reunited_count: 0,
    pending_verifications_count: 0,
    active_disasters_count: 1,
    vulnerable_minors_count: 0
  });
  const [trackerQuery, setTrackerQuery] = useState('');
  const { isOnline } = useNetwork();
  const { loginWithRole } = useAuth();
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
      <section className="relative bg-gradient-to-b from-red-50 via-white to-gray-50 pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-red-100">
        <div className="max-w-7xl mx-auto text-center space-y-8">
          
          {/* Active Disaster Alert Pill */}
          <div className="inline-flex items-center gap-2 bg-white border-2 border-brand-600 px-4 py-1.5 rounded-full text-xs font-bold text-brand-700 shadow-emergency animate-pulse-subtle">
            <Radio className="w-4 h-4 text-brand-600 animate-pulse" />
            <span>DISASTER RESPONSE ACTIVE: CYCLONE VARDHA RELIEF CORRIDOR</span>
          </div>

          {/* Headline */}
          <div className="space-y-4 max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-none">
              Reuniting Families Separated by <span className="text-brand-600 underline decoration-red-300 decoration-wavy">Disaster</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              When communication networks collapse, <strong>REUNITE-X</strong> operates offline in relief camps, applies AI facial vector matching, and empowers rescue teams, hospitals, and disaster authorities to reconnect loved ones safely.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-xl mx-auto pt-1">
            <Link
              to="/report-missing"
              className="btn-emergency text-base py-3.5 px-6 shadow-emergency-lg hover:scale-105"
            >
              <UserPlus className="w-5 h-5 mr-1.5" />
              Report Missing Person
            </Link>
            <Link
              to="/report-found"
              className="btn-outline-emergency text-base py-3.5 px-6 hover:scale-105"
            >
              <HeartHandshake className="w-5 h-5 mr-1.5" />
              Report Found Person
            </Link>
          </div>

          {/* Quick Case Tracker Search Bar */}
          <div className="max-w-xl mx-auto pt-4">
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

          {/* Offline Notice */}
          {!isOnline && (
            <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-950 text-xs font-bold px-4 py-2 rounded-xl border border-yellow-300">
              <WifiOff className="w-4 h-4 text-yellow-700" />
              <span>Offline Mode Active: Reports saved locally in IndexedDB (Dexie.js) will auto-sync upon reconnection.</span>
            </div>
          )}
        </div>
      </section>

      {/* Role Workspaces Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs uppercase font-black tracking-widest text-brand-600 bg-red-100 px-3 py-1 rounded-full">
            Role-Based Portals
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Dedicated Stakeholder Workspaces</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Select a role persona to access tailored tools for field rescue, hospital triage, camp shelter management, and official verification.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Family */}
          <div className="card-white p-5 border-2 border-transparent hover:border-rose-400 transition space-y-3 flex flex-col justify-between">
            <div>
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 w-fit mb-2">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">Family & Citizen</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Report missing relatives, search safe directory, and receive verified reunification updates.
              </p>
            </div>
            <Link
              to="/report-missing"
              onClick={() => loginWithRole('family')}
              className="text-xs font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1"
            >
              Report / Search →
            </Link>
          </div>

          {/* Rescue Team */}
          <div className="card-white p-5 border-2 border-transparent hover:border-amber-400 transition space-y-3 flex flex-col justify-between">
            <div>
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 w-fit mb-2">
                <Ambulance className="w-5 h-5" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">Rescue Team</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Register rescued individuals from flood/rubble zones, assign triage tags, and update transit.
              </p>
            </div>
            <Link
              to="/rescue-team"
              onClick={() => loginWithRole('rescue_team')}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
            >
              Rescue Desk →
            </Link>
          </div>

          {/* Hospital */}
          <div className="card-white p-5 border-2 border-transparent hover:border-blue-400 transition space-y-3 flex flex-col justify-between">
            <div>
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 w-fit mb-2">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">Hospital</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Admit trauma victims, record clinical diagnosis, assign ward/bed IDs, and update health status.
              </p>
            </div>
            <Link
              to="/hospital"
              onClick={() => loginWithRole('hospital')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              Hospital Ward →
            </Link>
          </div>

          {/* Shelter */}
          <div className="card-white p-5 border-2 border-transparent hover:border-emerald-400 transition space-y-3 flex flex-col justify-between">
            <div>
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 w-fit mb-2">
                <Tent className="w-5 h-5" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">Shelter / Camp</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Intake displaced residents, manage tent/block assignments, and record camp location updates.
              </p>
            </div>
            <Link
              to="/shelter"
              onClick={() => loginWithRole('shelter')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
            >
              Shelter Desk →
            </Link>
          </div>

          {/* Authority */}
          <div className="card-white p-5 border-2 border-transparent hover:border-red-600 transition space-y-3 flex flex-col justify-between">
            <div>
              <div className="p-2.5 rounded-xl bg-red-100 text-brand-700 w-fit mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">Authority (NDRF)</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Verify AI candidate matches side-by-side, notify families, manage cases, and finalize closures.
              </p>
            </div>
            <Link
              to="/authority"
              onClick={() => loginWithRole('authority')}
              className="text-xs font-bold text-brand-700 hover:text-brand-900 flex items-center gap-1"
            >
              Authority Queue →
            </Link>
          </div>
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

      {/* Call to Action Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-brand-600 text-white rounded-3xl p-8 sm:p-12 shadow-emergency-lg flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h3 className="text-2xl sm:text-3xl font-black">Need to Report or Track a Separated Family Member?</h3>
            <p className="text-red-100 text-sm">
              Submit details online or offline. Every profile is cross-referenced continuously with relief camps, field rescue rosters, and hospital admissions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/report-missing"
              className="bg-white text-brand-700 font-bold px-6 py-3.5 rounded-xl shadow hover:bg-red-50 transition text-sm flex items-center gap-2"
            >
              Start Missing Report <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/search"
              className="bg-red-800 text-white font-bold px-6 py-3.5 rounded-xl border border-red-400 hover:bg-red-900 transition text-sm"
            >
              Search Directory
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
