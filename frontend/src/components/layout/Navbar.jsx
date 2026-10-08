import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  Radio
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';

export default function Navbar() {
  const { user, loginWithRole, logout } = useAuth();
  const { isOnline, pendingCount } = useNetwork();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isAuthority = user?.role === 'authority' || user?.role === 'admin';
  const isVolunteer = user?.role === 'volunteer';

  const isActive = (path) => location.pathname === path;

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
          <span>Cyclone Vardha Impact Relief Corridor</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <span className="inline-flex items-center gap-1 text-red-100 text-xs">
                <Wifi className="w-3.5 h-3.5" /> Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-white text-brand-700 px-2 py-0.5 rounded-full font-bold text-xs animate-pulse">
                <WifiOff className="w-3.5 h-3.5" /> OFFLINE MODE
              </span>
            )}
          </div>
          {pendingCount > 0 && (
            <span className="bg-yellow-400 text-slate-900 px-2 py-0.5 rounded-full font-bold text-xs">
              {pendingCount} Pending Sync
            </span>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
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

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/search"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                isActive('/search') 
                  ? 'bg-brand-50 text-brand-700 font-bold' 
                  : 'text-slate-700 hover:text-brand-600 hover:bg-gray-50'
              }`}
            >
              Search Directory
            </Link>
            <Link
              to="/report-missing"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                isActive('/report-missing') 
                  ? 'bg-brand-50 text-brand-700 font-bold' 
                  : 'text-slate-700 hover:text-brand-600 hover:bg-gray-50'
              }`}
            >
              Report Missing
            </Link>
            <Link
              to="/report-found"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                isActive('/report-found') 
                  ? 'bg-brand-50 text-brand-700 font-bold' 
                  : 'text-slate-700 hover:text-brand-600 hover:bg-gray-50'
              }`}
            >
              Report Found
            </Link>
            <Link
              to="/tracker"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                isActive('/tracker') 
                  ? 'bg-brand-50 text-brand-700 font-bold' 
                  : 'text-slate-700 hover:text-brand-600 hover:bg-gray-50'
              }`}
            >
              Case Tracker
            </Link>
            <Link
              to="/map"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                isActive('/map') 
                  ? 'bg-brand-50 text-brand-700 font-bold' 
                  : 'text-slate-700 hover:text-brand-600 hover:bg-gray-50'
              }`}
            >
              Live Map
            </Link>

            {/* Authority Review Queue link if authority */}
            {isAuthority && (
              <Link
                to="/authority"
                className={`px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${
                  isActive('/authority') 
                    ? 'bg-brand-600 text-white shadow-sm' 
                    : 'text-brand-700 bg-red-100 hover:bg-red-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Authority Queue
              </Link>
            )}
          </nav>

          {/* Role Switcher & Auth Pill */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              <span className="text-gray-500 px-2">Role:</span>
              <button
                onClick={() => loginWithRole('public', 'Citizen User')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  user?.role === 'public' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-gray-600 hover:text-black'
                }`}
              >
                Public
              </button>
              <button
                onClick={() => loginWithRole('volunteer', 'Rohan (Volunteer)')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  user?.role === 'volunteer' ? 'bg-emerald-600 text-white shadow-sm font-bold' : 'text-gray-600 hover:text-black'
                }`}
              >
                Volunteer
              </button>
              <button
                onClick={() => loginWithRole('authority', 'Capt. Vikram (NDRF)')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  user?.role === 'authority' ? 'bg-brand-600 text-white shadow-sm font-bold' : 'text-gray-600 hover:text-black'
                }`}
              >
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
        <div className="md:hidden bg-white border-t border-gray-200 px-4 pt-3 pb-6 space-y-2">
          <Link
            to="/report-missing"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2.5 rounded-lg text-base font-bold bg-brand-600 text-white text-center"
          >
            Report Missing Person
          </Link>
          <Link
            to="/report-found"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2.5 rounded-lg text-base font-bold border-2 border-brand-600 text-brand-600 text-center"
          >
            Report Found Person
          </Link>
          <div className="border-t border-gray-100 my-2 pt-2 space-y-1">
            <Link
              to="/search"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-gray-50"
            >
              Search Directory
            </Link>
            <Link
              to="/tracker"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-gray-50"
            >
              Case Tracker
            </Link>
            <Link
              to="/map"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-gray-50"
            >
              Live Map
            </Link>
            {isAuthority && (
              <Link
                to="/authority"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-bold text-brand-700 bg-red-50"
              >
                Authority Review Queue
              </Link>
            )}
          </div>
          {/* Mobile Role Switcher */}
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500 font-semibold mb-1">Switch Persona:</p>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => { loginWithRole('public'); setMobileMenuOpen(false); }}
                className={`py-1.5 rounded text-xs font-bold ${user?.role === 'public' ? 'bg-slate-900 text-white' : 'bg-gray-100'}`}
              >
                Public
              </button>
              <button
                onClick={() => { loginWithRole('volunteer'); setMobileMenuOpen(false); }}
                className={`py-1.5 rounded text-xs font-bold ${user?.role === 'volunteer' ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}
              >
                Volunteer
              </button>
              <button
                onClick={() => { loginWithRole('authority'); setMobileMenuOpen(false); }}
                className={`py-1.5 rounded text-xs font-bold ${user?.role === 'authority' ? 'bg-brand-600 text-white' : 'bg-gray-100'}`}
              >
                Authority
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
