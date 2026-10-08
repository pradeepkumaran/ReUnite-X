import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  Users, 
  FileText, 
  Wifi, 
  WifiOff, 
  UploadCloud, 
  Database, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Sparkles, 
  ShieldCheck, 
  Bell, 
  PhoneCall, 
  HeartHandshake, 
  Lock, 
  Ambulance, 
  Building2, 
  Tent, 
  ArrowDown, 
  ArrowRight, 
  Play, 
  RotateCcw,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { useAuth, ROLE_PROFILES } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import api from '../api/client';

export default function InteractiveWorkflowHub() {
  const { user, loginWithRole } = useAuth();
  const { isOnline, toggleSimulateOffline } = useNetwork();
  const [activeStep, setActiveStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState(null);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(err => console.warn('Stats fetch error:', err));
  }, []);

  // Auto-play simulation
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveStep(prev => (prev >= 17 ? 1 : prev + 1));
      }, 2400);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  const workflowSteps = [
    {
      id: 1,
      title: 'DISASTER OCCURS',
      subtitle: 'Cyclone / Flood / Earthquake strikes disaster zone',
      role: 'System / Crisis Response',
      desc: 'Catastrophic event leads to population displacement and family disruption.',
      status: 'Active Zone: Nagapattinam Relief Corridor (Radius 45km)',
      badge: 'Disaster Trigger',
      color: 'border-red-500 bg-red-50 text-red-900',
    },
    {
      id: 2,
      title: 'PERSON SEPARATED',
      subtitle: 'Family members separated during chaos & evacuation',
      role: 'Displaced Individuals',
      desc: 'Children, elderly and injured lose contact with family units during emergency transport.',
      status: 'High Vulnerability Incident',
      badge: 'Separation',
      color: 'border-orange-500 bg-orange-50 text-orange-900',
    },
    {
      id: 3,
      title: 'MISSING REPORT CREATED',
      subtitle: 'Family or bystander files missing report',
      role: 'FAMILY / CITIZEN',
      desc: 'Family inputs names, photos, distinct marks, clothing details, and last seen point.',
      status: 'Intake Initiated',
      badge: 'Report Intake',
      color: 'border-rose-500 bg-rose-50 text-rose-900',
      actionLink: '/report-missing',
      actionLabel: 'Try Reporting Missing'
    },
    {
      id: 4,
      title: 'COLLECT DETAILS',
      subtitle: 'Demographics, photos, coordinates, medical needs',
      role: 'Intake Engine',
      desc: 'Formal consent recorded. Minor status shielded automatically (<18 yrs).',
      status: 'PII Protection Enforced',
      badge: 'Data Collection',
      color: 'border-amber-500 bg-amber-50 text-amber-900',
    },
    {
      id: 5,
      title: 'ONLINE vs OFFLINE MODE',
      subtitle: isOnline ? 'Online Mode Active: Direct API transmission' : 'Offline Mode Active: Local IndexedDB storage',
      role: 'Client App (PWA & Dexie.js)',
      desc: 'When cellular towers collapse, records are stored locally with RFC-4122 v4 UUIDs.',
      status: isOnline ? 'Connected to Central API' : 'Zero-Network Resilient Storage',
      badge: isOnline ? 'Online Channel' : 'Offline Stored',
      color: isOnline ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-yellow-500 bg-yellow-50 text-yellow-900',
      customAction: () => toggleSimulateOffline(),
      customActionLabel: isOnline ? 'Simulate Disconnected Outage' : 'Restore Online Mode'
    },
    {
      id: 6,
      title: 'SYNC / UPLOAD',
      subtitle: 'Idempotent batch upload when connectivity returns',
      role: 'SyncManager & Dexie.js',
      desc: 'SyncManager uploads queued reports via /sync/batch with conflict resolution.',
      status: 'Conflict Resolution: Client UUID Unique',
      badge: 'Batch Sync',
      color: 'border-indigo-500 bg-indigo-50 text-indigo-900',
    },
    {
      id: 7,
      title: 'CENTRAL DATABASE',
      subtitle: 'Supabase PostgreSQL & pgvector schema',
      role: 'Data Tier',
      desc: 'Records validated against Pydantic schemas and saved with timestamp & audit trail.',
      status: 'PostgreSQL ACID Storage',
      badge: 'Database',
      color: 'border-cyan-500 bg-cyan-50 text-cyan-900',
    },
    {
      id: 8,
      title: 'DUPLICATE CHECK',
      subtitle: 'Identifies redundant submissions (Cosine > 0.92)',
      role: 'AI Ingestion Pipeline',
      desc: 'Checks existing reports of same type to prevent record bloating and fragmentation.',
      status: 'Cosine Threshold: 0.92 + Age & Gender Match',
      badge: 'Deduplication',
      color: 'border-teal-500 bg-teal-50 text-teal-900',
    },
    {
      id: 9,
      title: 'SEARCH / REPORT',
      subtitle: 'Public search with automated minor redaction',
      role: 'FAMILY & CITIZEN',
      desc: 'Families search by name, description or GPS radius with child phone/contact shielded.',
      status: 'Minor Protection Active',
      badge: 'Directory Search',
      color: 'border-emerald-500 bg-emerald-50 text-emerald-900',
      actionLink: '/search',
      actionLabel: 'Test Directory Search'
    },
    {
      id: 10,
      title: 'AI MATCHING ENGINE',
      subtitle: '512-dimensional facial embedding + multimodal fusion',
      role: 'InsightFace & Vector Engine',
      desc: 'Facial landmarks aligned; cosine distance calculated using pgvector HNSW index.',
      status: 'Face (60%) + Demographics (15%) + Geo (15%) + Text (10%)',
      badge: 'AI Vector Match',
      color: 'border-purple-500 bg-purple-50 text-purple-900',
    },
    {
      id: 11,
      title: 'CANDIDATE MATCHES',
      subtitle: 'Prospective pairs placed in Pending Review Queue',
      role: 'Matching Service',
      desc: 'Zero automatic approvals. Cases transition to candidate_found awaiting human officer.',
      status: 'Awaiting Official Review',
      badge: 'Candidate Queue',
      color: 'border-violet-500 bg-violet-50 text-violet-900',
      actionLink: '/authority',
      actionLabel: 'Inspect Candidate Queue'
    },
    {
      id: 12,
      title: 'MATCH SCORE',
      subtitle: 'Blended 0 - 100 confidence score generated',
      role: 'AI Fusion Model',
      desc: 'Blended confidence weights physical appearance, age, gender, coordinates and keywords.',
      status: 'Threshold Gate: >= 65% for Review',
      badge: 'Confidence Score',
      color: 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-900',
    },
    {
      id: 13,
      title: 'PRIORITY SCORE',
      subtitle: 'Vulnerability weighting (Minors +20, Medical +15, Elderly +15)',
      role: 'Triage Scoring',
      desc: 'Critical children, disoriented elderly, and asthma/insulin patients ranked to the top.',
      status: 'Vulnerability Boost Active',
      badge: 'Urgency Priority',
      color: 'border-pink-500 bg-pink-50 text-pink-900',
    },
    {
      id: 14,
      title: 'AUTHORITY VERIFICATION',
      subtitle: 'Strict human-in-the-loop review by NDRF officer',
      role: 'AUTHORITY (NDRF HQ)',
      desc: 'Official inspects side-by-side photos, landmarks, birthmarks, and clothing notes.',
      status: 'Decision Gate: Verified vs Not Verified',
      badge: 'Official Human Gate',
      color: 'border-red-600 bg-red-100 text-red-950 font-bold',
      actionLink: '/authority',
      actionLabel: 'Open Authority Review Station'
    },
    {
      id: 15,
      title: 'VERIFIED → STATUS & LOCATION UPDATED',
      subtitle: 'Both cases marked verified; confirmed shelter coords recorded',
      role: 'Verification Workflow',
      desc: 'Audit log stamped with officer badge ID. Shelter camp location locked in.',
      status: 'Status: verified | Location Confirmed',
      badge: 'Verification Success',
      color: 'border-emerald-600 bg-emerald-50 text-emerald-950',
    },
    {
      id: 16,
      title: 'NOTIFICATION SENT → FAMILY CONTACTED',
      subtitle: 'Emergency notification dispatched to family email & phone',
      role: 'Notification Engine',
      desc: 'Family notified with official relief desk contact details and shelter pickup point.',
      status: 'Multi-Channel Alert Dispatched',
      badge: 'Family Alerted',
      color: 'border-blue-600 bg-blue-50 text-blue-950',
    },
    {
      id: 17,
      title: 'REUNITED → CASE CLOSED',
      subtitle: 'Physical custody confirmed; case transitions to reunited then closed',
      role: 'AUTHORITY & FAMILY',
      desc: 'Family and victim reunited at Camp Delta 3. Officer records final closure in audit log.',
      status: 'Case Closed: Safe Family Custody',
      badge: 'Reunited & Closed',
      color: 'border-emerald-700 bg-emerald-100 text-emerald-950 font-black',
      actionLink: '/tracker?q=REX-2026-00001',
      actionLabel: 'Track Reunited Dossier'
    },
  ];

  const currentStepData = workflowSteps.find(s => s.id === activeStep) || workflowSteps[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="card-white border-l-8 border-l-brand-600 p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-brand-100 text-brand-700">
              <Layers className="w-6 h-6 stroke-[2.5]" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                Disaster Response Operational Lifecycle
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Interactive flowchart & command hub tracking separated victims from crisis impact to verified family reunification.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Play Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                : 'bg-brand-600 hover:bg-brand-700 text-white'
            }`}
          >
            {isPlaying ? (
              <><span>⏸</span> Pause Simulation</>
            ) : (
              <><Play className="w-4 h-4 fill-current" /> Auto-Play Flowchart</>
            )}
          </button>
          <button
            onClick={() => { setActiveStep(1); setIsPlaying(false); }}
            className="p-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-slate-600 text-xs font-bold transition flex items-center gap-1.5"
            title="Reset to Step 1"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      {/* Role Switcher Deck */}
      <div className="card-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Switch Active Operational Persona:
            </h3>
            <p className="text-xs text-slate-500">
              Test each stakeholder role to experience their tailored dashboard and capabilities.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            Current: {user?.title || user?.full_name}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {Object.entries(ROLE_PROFILES).map(([roleKey, profile]) => {
            const isSelected = user?.role === roleKey;
            return (
              <button
                key={roleKey}
                onClick={() => loginWithRole(roleKey)}
                className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'border-brand-600 bg-red-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-400 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">{profile.label}</span>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-brand-600"></span>}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                    {profile.description}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-brand-700 mt-2 block">
                  {isSelected ? '✓ Active Role' : 'Switch →'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Step Highlight Card */}
      <div className={`card-white border-2 ${currentStepData.color} p-6 space-y-4 shadow-emergency transition-all`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-black/10 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-full bg-black/10">
                Step {currentStepData.id} of {workflowSteps.length}
              </span>
              <span className="font-black text-xs uppercase tracking-wider">
                Role: {currentStepData.role}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-1">{currentStepData.title}</h2>
            <p className="text-xs font-bold opacity-80">{currentStepData.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            {currentStepData.actionLink && (
              <Link
                to={currentStepData.actionLink}
                className="btn-emergency text-xs py-2 px-4 flex items-center gap-1.5"
              >
                {currentStepData.actionLabel || 'Go to Page'} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {currentStepData.customAction && (
              <button
                onClick={currentStepData.customAction}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-black transition"
              >
                {currentStepData.customActionLabel}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <strong className="block text-slate-700 mb-1">Operational Description:</strong>
            <p className="leading-relaxed opacity-90">{currentStepData.desc}</p>
          </div>
          <div>
            <strong className="block text-slate-700 mb-1">Live State & Parameters:</strong>
            <span className="font-mono font-bold block bg-black/5 p-2 rounded-lg">
              {currentStepData.status}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Visual Flowchart Grid */}
      <div className="card-white space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-600" /> Complete Flowchart Diagram (Click Any Stage)
          </h3>
          <span className="text-xs text-slate-400">17 Operational Steps</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {workflowSteps.map(step => {
            const isActive = activeStep === step.id;
            return (
              <div
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  isActive
                    ? 'border-brand-600 bg-red-50/50 shadow-md ring-2 ring-red-400 scale-[1.02]'
                    : 'border-gray-200 hover:border-gray-400 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[10px] font-black text-slate-400">
                      #{step.id}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-brand-600 text-white' : 'bg-gray-100 text-slate-600'
                    }`}>
                      {step.badge}
                    </span>
                  </div>
                  <h4 className="font-black text-slate-900 text-xs leading-snug">{step.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{step.subtitle}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-brand-700">{step.role}</span>
                  <span className="text-slate-400">Inspect →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dedicated Role Portals Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rescue Team */}
        <Link
          to="/rescue-team"
          className="card-white p-5 hover:border-amber-500 border-2 border-transparent transition space-y-3 group"
        >
          <div className="p-3 rounded-2xl bg-amber-100 text-amber-700 w-fit group-hover:scale-110 transition">
            <Ambulance className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-base">Rescue Team Desk</h4>
            <p className="text-xs text-slate-500 mt-1">
              Register rescued individuals, assign triage tags (Red/Yellow/Green), and record transit destinations.
            </p>
          </div>
          <div className="text-xs font-bold text-amber-700 flex items-center gap-1">
            Open Rescue Portal <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Hospital */}
        <Link
          to="/hospital"
          className="card-white p-5 hover:border-blue-500 border-2 border-transparent transition space-y-3 group"
        >
          <div className="p-3 rounded-2xl bg-blue-100 text-blue-700 w-fit group-hover:scale-110 transition">
            <Building2 className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-base">Hospital Medical Desk</h4>
            <p className="text-xs text-slate-500 mt-1">
              Admit unidentified disaster patients, assign ICU / ward beds, and update clinical recovery status.
            </p>
          </div>
          <div className="text-xs font-bold text-blue-700 flex items-center gap-1">
            Open Hospital Portal <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Shelter */}
        <Link
          to="/shelter"
          className="card-white p-5 hover:border-emerald-500 border-2 border-transparent transition space-y-3 group"
        >
          <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700 w-fit group-hover:scale-110 transition">
            <Tent className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-base">Shelter & Camp Desk</h4>
            <p className="text-xs text-slate-500 mt-1">
              Intake displaced residents, manage tent & sector assignments, record special ration and infant needs.
            </p>
          </div>
          <div className="text-xs font-bold text-emerald-700 flex items-center gap-1">
            Open Shelter Portal <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Authority */}
        <Link
          to="/authority"
          className="card-white p-5 hover:border-red-600 border-2 border-transparent transition space-y-3 group"
        >
          <div className="p-3 rounded-2xl bg-red-100 text-brand-700 w-fit group-hover:scale-110 transition">
            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-base">Authority HQ Queue</h4>
            <p className="text-xs text-slate-500 mt-1">
              Human-in-the-loop review station. Compare facial landmarks, verify matches, alert families, and close cases.
            </p>
          </div>
          <div className="text-xs font-bold text-brand-700 flex items-center gap-1">
            Open Authority Review <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>
    </div>
  );
}
