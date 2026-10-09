import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  HeartHandshake, 
  Search, 
  UserPlus, 
  ShieldCheck, 
  MapPin, 
  BarChart2, 
  Wifi, 
  WifiOff, 
  Menu, 
  X,
  FileSearch,
  Radio,
  Ambulance,
  Building2,
  Tent,
  Layers,
  ChevronDown,
  UserCheck,
  Users,
  Clock,
  Database
} from 'lucide-react';
import { useAuth, ROLE_PROFILES } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';
import apiClient from '../../api/client';
import { checkSupabaseDirectStatus } from '../../services/supabase';
import DatabaseStatusModal from '../common/DatabaseStatusModal';

export default function Navbar() {
  const { user, loginWithRole, isAuthority, isRescueTeam, isHospital, isShelter, isFamily } = useAuth();
  const { isOnline, toggleSimulateOffline, pendingCount, openQueueDrawer } = useNetwork();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  const fetchDbStatus = async () => {
    try {
      const res = await apiClient.get('/database/status');
      if (res.data && res.data.supabase_connected) {
        setDbStatus(res.data);
        return;
      }
      const direct = await checkSupabaseDirectStatus();
      setDbStatus({
        ...(res.data || {}),
        ...direct,
        supabase_connected: Boolean(direct?.supabase_connected || res.data?.supabase_connected),
      });
    } catch {
      try {
        const direct = await checkSupabaseDirectStatus();
        setDbStatus(direct);
      } catch {
        setDbStatus({
          supabase_configured: false,
          supabase_connected: false,
          mode: 'Offline IndexedDB Store',
        });
      }
    }
  };

  useEffect(() => {
    fetchDbStatus();
    const interval = setInterval(fetchDbStatus, 15000);
    return () => clearInterval(interval);
  }, []);


  const isActive = (path) => location.pathname === path;

  const handleRoleSelect = (roleKey, targetPath) => {
    loginWithRole(roleKey);
    if (targetPath) {
      navigate(targetPath);
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b-2 border-brand-600 shadow-sm">
      {/* Top Crisis Notification Ribbon */}
      <div className="bg-brand-600 text-white text-xs font-semibold py-1.5 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span className="tracking-wide uppercase font-bold text-xs">CRISIS ACTIVE:</span>
          <span className="hidden sm:inline">Cyclone Vardha Impact Relief Corridor (Nagapattinam)</span>
          <span className="sm:hidden">Cyclone Relief</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Database & Supabase Status Pill */}
          <button
            onClick={() => setDbModalOpen(true)}
            title="Database Status: Click to inspect Supabase cloud connectivity & local storage"
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] transition cursor-pointer ${
              dbStatus?.supabase_connected
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-400'
                : 'bg-red-800 hover:bg-red-900 text-white/90 border border-red-500/60'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">
              {dbStatus?.supabase_connected ? 'Supabase Connected' : 'DB: Local SQLite'}
            </span>
            <span className="sm:hidden">
              {dbStatus?.supabase_connected ? 'Supabase' : 'SQLite'}
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleSimulateOffline}
              title="Click to toggle between Online Mode and Offline Storage simulation"
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] transition cursor-pointer ${
                isOnline 
                  ? 'bg-red-700 hover:bg-red-800 text-white border border-red-500' 
                  : 'bg-yellow-400 text-slate-900 animate-pulse'
              }`}
            >
              {isOnline ? (
                <><Wifi className="w-3.5 h-3.5" /> Online Mode</>
              ) : (
                <><WifiOff className="w-3.5 h-3.5" /> OFFLINE MODE (Dexie.js)</>
              )}
            </button>
          </div>
          {pendingCount > 0 && (
            <button
              onClick={openQueueDrawer}
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 px-2.5 py-0.5 rounded-full font-black text-xs transition shadow-sm cursor-pointer"
            >
              {pendingCount} Pending Sync
            </button>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-emergency group-hover:bg-brand-700 transition">
              <HeartHandshake className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-brand-700">
                REUNITE<span className="text-slate-900">-X</span>
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-brand-600 -mt-1">
                Disaster Response
              </span>
            </div>
          </Link>

          {/* Integrated Desktop Navigation & Role Switcher Toolbar */}
          <div className="hidden md:flex items-center gap-3">
            {/* Search Directory & Case Tracker Segment */}
            <nav className="flex items-center gap-1 bg-slate-100/80 border border-slate-200/90 rounded-2xl p-1 shadow-sm">
              <Link
                to="/search"
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive('/search') 
                    ? 'bg-white text-brand-700 font-black shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-brand-600" />
                Search Directory
              </Link>
              <Link
                to="/tracker"
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive('/tracker') 
                    ? 'bg-white text-brand-700 font-black shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Case Tracker
              </Link>
            </nav>

            {/* Subtle Divider */}
            <div className="h-5 w-px bg-slate-200 hidden lg:block" />

            {/* Role Switcher (Interactive Role Column) */}
            <div className="flex items-center gap-1 bg-slate-100/80 border border-slate-200/90 rounded-2xl p-1 shadow-sm">
              <span className="text-[10px] text-slate-400 uppercase px-2 font-black tracking-wider select-none">
                ROLE:
              </span>
              <button
                onClick={() => handleRoleSelect('family', '/report-missing')}
                title="Switch to Family Persona & Report Missing"
                className={`px-2.5 py-1.5 rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 ${
                  isFamily ? 'bg-slate-900 text-white shadow-sm font-black' : 'text-slate-600 hover:text-black hover:bg-white/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Family
              </button>
              <button
                onClick={() => handleRoleSelect('rescue_team', '/rescue-team')}
                title="Switch to Rescue Team & Open Field Desk"
                className={`px-2.5 py-1.5 rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 ${
                  isRescueTeam ? 'bg-amber-600 text-white shadow-sm font-black' : 'text-slate-600 hover:text-amber-800 hover:bg-amber-50/60'
                }`}
              >
                <Ambulance className="w-3.5 h-3.5" />
                Rescue
              </button>
              <button
                onClick={() => handleRoleSelect('hospital', '/hospital')}
                title="Switch to Hospital & Open Patient Admissions"
                className={`px-2.5 py-1.5 rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 ${
                  isHospital ? 'bg-blue-600 text-white shadow-sm font-black' : 'text-slate-600 hover:text-blue-800 hover:bg-blue-50/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Hospital
              </button>
              <button
                onClick={() => handleRoleSelect('shelter', '/shelter')}
                title="Switch to Shelter & Open Resident Desk"
                className={`px-2.5 py-1.5 rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 ${
                  isShelter ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/60'
                }`}
              >
                <Tent className="w-3.5 h-3.5" />
                Shelter
              </button>
              <button
                onClick={() => handleRoleSelect('authority', '/authority')}
                title="Switch to Authority & Open Verification HQ"
                className={`px-2.5 py-1.5 rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 ${
                  isAuthority ? 'bg-brand-600 text-white shadow-sm font-black' : 'text-slate-600 hover:text-brand-800 hover:bg-red-50/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Authority
              </button>
            </div>
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-white border-t border-gray-200 px-4 pt-3 pb-6 space-y-3">
          {/* Role selector on mobile */}
          <div className="bg-gray-50 p-2.5 rounded-2xl border border-gray-200 space-y-1.5">
            <span className="text-[10px] uppercase font-black text-slate-500 block px-1">Active Role Persona:</span>
            <div className="grid grid-cols-3 gap-1 text-xs font-bold">
              <button
                onClick={() => handleRoleSelect('family', '/report-missing')}
                className={`py-1.5 px-2 rounded-xl text-center ${isFamily ? 'bg-slate-900 text-white font-black' : 'bg-white border text-slate-700'}`}
              >
                Family
              </button>
              <button
                onClick={() => handleRoleSelect('rescue_team', '/rescue-team')}
                className={`py-1.5 px-2 rounded-xl text-center ${isRescueTeam ? 'bg-amber-600 text-white font-black' : 'bg-white border text-slate-700'}`}
              >
                Rescue
              </button>
              <button
                onClick={() => handleRoleSelect('hospital', '/hospital')}
                className={`py-1.5 px-2 rounded-xl text-center ${isHospital ? 'bg-blue-600 text-white font-black' : 'bg-white border text-slate-700'}`}
              >
                Hospital
              </button>
              <button
                onClick={() => handleRoleSelect('shelter', '/shelter')}
                className={`py-1.5 px-2 rounded-xl text-center ${isShelter ? 'bg-emerald-600 text-white font-black' : 'bg-white border text-slate-700'}`}
              >
                Shelter
              </button>
              <button
                onClick={() => handleRoleSelect('authority', '/authority')}
                className={`py-1.5 px-2 rounded-xl text-center ${isAuthority ? 'bg-brand-600 text-white font-black' : 'bg-white border text-slate-700'}`}
              >
                Authority
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-2 space-y-1">
            <Link
              to="/search"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-800 hover:bg-gray-50 flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-brand-600" />
              Search Directory
            </Link>
            <Link
              to="/tracker"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-800 hover:bg-gray-50 flex items-center gap-2"
            >
              <Clock className="w-4 h-4 text-slate-600" />
              Case Tracker
            </Link>
            <Link
              to="/authority"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs font-bold text-brand-700 bg-red-50"
            >
              Authority Review Queue
            </Link>
            <Link
              to="/map"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-gray-50"
            >
              Live Map
            </Link>
            <Link
              to="/analytics"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-gray-50"
            >
              Disaster Analytics
            </Link>
          </div>
        </div>
      )}

      {/* Database Connection & Status Modal */}
      <DatabaseStatusModal
        isOpen={dbModalOpen}
        onClose={() => setDbModalOpen(false)}
        dbStatus={dbStatus}
        onRefresh={fetchDbStatus}
      />
    </header>
  );
}
