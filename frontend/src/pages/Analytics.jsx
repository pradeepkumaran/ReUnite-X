import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  CheckCircle2, 
  Users, 
  ShieldAlert, 
  Clock, 
  FileCheck 
} from 'lucide-react';
import api from '../api/client';

export default function Analytics() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(err => console.log('Stats error:', err));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="card-white border-l-8 border-l-brand-600 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-brand-600" />
            <h1 className="text-2xl font-black text-slate-900">Disaster Situational Analytics</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time aggregate telemetry across intake pipelines, vector matching, and official verifications.
          </p>
        </div>
      </div>

      {stats && (
        <div className="space-y-6">
          {/* Top High-level KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-white border-t-4 border-t-brand-600">
              <span className="text-xs font-bold text-slate-400 uppercase">Total Intake Cases</span>
              <div className="text-3xl font-black text-slate-900 mt-1">{stats.total_cases}</div>
            </div>
            <div className="card-white border-t-4 border-t-emerald-600">
              <span className="text-xs font-bold text-slate-400 uppercase">Reunifications Closed</span>
              <div className="text-3xl font-black text-emerald-600 mt-1">{stats.reunited_count}</div>
            </div>
            <div className="card-white border-t-4 border-t-amber-500">
              <span className="text-xs font-bold text-slate-400 uppercase">Pending Review</span>
              <div className="text-3xl font-black text-amber-600 mt-1">{stats.pending_verifications_count}</div>
            </div>
            <div className="card-white border-t-4 border-t-red-800">
              <span className="text-xs font-bold text-slate-400 uppercase">Shielded Minors</span>
              <div className="text-3xl font-black text-red-800 mt-1">{stats.vulnerable_minors_count}</div>
            </div>
          </div>

          {/* Operational Pipeline Funnel */}
          <div className="card-white space-y-4">
            <h3 className="text-base font-black text-slate-900 border-b border-gray-100 pb-2">
              Humanitarian Pipeline Status Distribution
            </h3>

            <div className="space-y-3">
              {[
                { label: 'Reported', count: stats.status_breakdown.reported, color: 'bg-red-400' },
                { label: 'Searching (AI Vector Loop)', count: stats.status_breakdown.searching, color: 'bg-amber-400' },
                { label: 'Candidate Found (Pending Review)', count: stats.status_breakdown.candidate_found, color: 'bg-yellow-500' },
                { label: 'Verified by Authority', count: stats.status_breakdown.verified, color: 'bg-blue-500' },
                { label: 'Family Notified', count: stats.status_breakdown.notified, color: 'bg-indigo-500' },
                { label: 'Reunited Successfully', count: stats.status_breakdown.reunited, color: 'bg-emerald-600' },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>{item.label}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`${item.color} h-3 rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max((item.count / (stats.total_cases || 1)) * 100, 6)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
