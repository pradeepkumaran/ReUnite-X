import React from 'react';
import { HeartHandshake, PhoneCall, ShieldAlert, FileText } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-red-100 mt-20">
      {/* Emergency Helpline Strip */}
      <div className="bg-brand-50 border-y border-red-100 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-brand-800 font-bold text-sm">
            <PhoneCall className="w-5 h-5 text-brand-600 animate-bounce" />
            <span>24/7 Disaster Coordination Helplines:</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
            <span className="bg-white px-3 py-1.5 rounded-lg border border-red-200">
              National Disaster Response Force: <strong className="text-brand-600">1078</strong>
            </span>
            <span className="bg-white px-3 py-1.5 rounded-lg border border-red-200">
              State Emergency Operations Center: <strong className="text-brand-600">1070</strong>
            </span>
            <span className="bg-white px-3 py-1.5 rounded-lg border border-red-200">
              Emergency Medical Ambulance: <strong className="text-brand-600">108</strong>
            </span>
            <span className="bg-white px-3 py-1.5 rounded-lg border border-red-200">
              Child Protection Emergency: <strong className="text-brand-600">1098</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <span className="text-lg font-extrabold text-slate-900">REUNITE-X</span>
            </div>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              Resilient disaster-response missing persons reunification platform.
              Operates offline in zero-connectivity disaster zones, matches candidate profiles
              via facial vector cosine similarity, and mandates official authority verification.
            </p>
            <div className="flex items-center gap-2 text-xs text-brand-700 font-semibold pt-1">
              <ShieldAlert className="w-4 h-4 text-brand-600" />
              Strict Minor Data Shielding Active
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Quick Actions</h4>
            <ul className="space-y-2 text-sm text-slate-600 font-medium">
              <li><a href="/report-missing" className="hover:text-brand-600">Report Missing Person</a></li>
              <li><a href="/report-found" className="hover:text-brand-600">Report Found Individual</a></li>
              <li><a href="/tracker" className="hover:text-brand-600">Track Case Number</a></li>
              <li><a href="/search" className="hover:text-brand-600">Public Case Directory</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Compliance & Privacy</h4>
            <ul className="space-y-2 text-sm text-slate-600 font-medium">
              <li><span className="text-slate-500">Zero Public AI Execution</span></li>
              <li><span className="text-slate-500">Human Authority Verification Gate</span></li>
              <li><span className="text-slate-500">Private Bucket Signed Photo URLs</span></li>
              <li><span className="text-slate-500">Immutable Audit Trail Logged</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© 2026 REUNITE-X Disaster Relief Technology. Built for Humanitarian Emergency Operations.</p>
          <p className="mt-2 sm:mt-0 font-semibold text-brand-600">Offline-First PWA Enabled</p>
        </div>
      </div>
    </footer>
  );
}
