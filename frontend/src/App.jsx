import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';

import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import StatusBanner from './components/common/StatusBanner';
import SyncQueueDrawer from './components/offline/SyncQueueDrawer';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ReportMissing from './pages/ReportMissing';
import ReportFound from './pages/ReportFound';
import CaseTracker from './pages/CaseTracker';
import Search from './pages/Search';
import AuthorityDashboard from './pages/AuthorityDashboard';
import RescueTeamDashboard from './pages/RescueTeamDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import ShelterDashboard from './pages/ShelterDashboard';
import InteractiveWorkflowHub from './pages/InteractiveWorkflowHub';
import MapView from './pages/MapView';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <NetworkProvider>
      <AuthProvider>
        <HashRouter>
          <div className="min-h-screen flex flex-col bg-gray-50 text-slate-900 selection:bg-brand-500 selection:text-white">
            <StatusBanner />
            <Navbar />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/workflow" element={<Navigate to="/" replace />} />
                <Route path="/rescue-team" element={<RescueTeamDashboard />} />
                <Route path="/hospital" element={<HospitalDashboard />} />
                <Route path="/shelter" element={<ShelterDashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/report-missing" element={<ReportMissing />} />
                <Route path="/report-found" element={<ReportFound />} />
                <Route path="/tracker" element={<CaseTracker />} />
                <Route path="/search" element={<Search />} />
                <Route path="/authority" element={<AuthorityDashboard />} />
                <Route path="/map" element={<MapView />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <SyncQueueDrawer />
            <Footer />
          </div>
        </HashRouter>
      </AuthProvider>
    </NetworkProvider>
  );
}
