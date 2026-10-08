import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Layers, 
  Compass, 
  Radio, 
  Users, 
  HeartHandshake, 
  AlertCircle 
} from 'lucide-react';
import api from '../api/client';

export default function MapView() {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [provider, setProvider] = useState('mapbox'); // swappable with 'google'

  useEffect(() => {
    api.get('/cases')
      .then(res => setCases(res.data))
      .catch(err => console.log('Map fetch error:', err));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 card-white border-l-8 border-l-brand-600">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-brand-600" />
            <h1 className="text-2xl font-black text-slate-900">Geospatial Situational Map</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Spatial distribution of last-seen points and relief shelter locations across Cyclone Vardha Corridor.
          </p>
        </div>

        {/* Swappable Map Provider Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          <span className="text-gray-500 px-2">Provider:</span>
          <button
            onClick={() => setProvider('mapbox')}
            className={`px-3 py-1 rounded-lg transition ${
              provider === 'mapbox' ? 'bg-white text-brand-700 shadow-sm font-bold' : 'text-gray-600'
            }`}
          >
            Mapbox GL
          </button>
          <button
            onClick={() => setProvider('google')}
            className={`px-3 py-1 rounded-lg transition ${
              provider === 'google' ? 'bg-white text-brand-700 shadow-sm font-bold' : 'text-gray-600'
            }`}
          >
            Google Maps
          </button>
        </div>
      </div>

      {/* Interactive Map Visual Stage */}
      <div className="card-white p-2 relative overflow-hidden h-[540px] rounded-3xl border-2 border-red-100 bg-slate-950">
        {/* Mock Map Background Canvas */}
        <div className="absolute inset-0 bg-slate-900 opacity-90">
          {/* Subtle Grid and Coastline Lines */}
          <svg className="w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#DC2626" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <circle cx="50%" cy="50%" r="220" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="6 6" />
          </svg>
        </div>

        {/* Legend Overlay */}
        <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm p-3 rounded-2xl shadow-lg border border-red-100 text-xs space-y-2">
          <span className="font-bold text-slate-900 block border-b border-gray-100 pb-1">
            Map Legend ({provider.toUpperCase()})
          </span>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-brand-600 inline-block shadow-sm"></span>
            <span className="font-semibold text-slate-700">Missing Person Last Seen</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
            <span className="font-semibold text-slate-700">Found Individual at Shelter</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-[10px]">
            <Radio className="w-3 h-3 text-brand-600 animate-pulse" />
            <span>45km Impact Radius Active</span>
          </div>
        </div>

        {/* Clustered Pins on Map Preview */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Pin 1: Missing child */}
          <div
            onClick={() => setSelectedCase({
              name: 'Aarav Sharma (8 yrs)',
              type: 'missing',
              case_num: 'REX-2026-00001',
              loc: 'Old Bus Stand Point'
            })}
            style={{ transform: 'translate(-40px, -20px)' }}
            className="pointer-events-auto cursor-pointer group relative flex flex-col items-center"
          >
            <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-emergency animate-bounce">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="bg-white text-slate-900 font-bold text-[10px] px-2 py-0.5 rounded shadow mt-1 opacity-90 group-hover:opacity-100">
              Aarav Sharma
            </span>
          </div>

          {/* Pin 2: Found child at shelter */}
          <div
            onClick={() => setSelectedCase({
              name: 'Unidentified Boy (says Appu)',
              type: 'found',
              case_num: 'REX-2026-00002',
              loc: 'Camp Delta 3 Shelter (0.8km away)'
            })}
            style={{ transform: 'translate(45px, 35px)' }}
            className="pointer-events-auto cursor-pointer group relative flex flex-col items-center"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg animate-bounce">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="bg-white text-slate-900 font-bold text-[10px] px-2 py-0.5 rounded shadow mt-1 opacity-90 group-hover:opacity-100">
              Boy at Camp Delta 3
            </span>
          </div>
        </div>

        {/* Selected Marker Drawer */}
        {selectedCase && (
          <div className="absolute bottom-4 inset-x-4 max-w-md mx-auto z-10 bg-white p-4 rounded-2xl shadow-emergency border-2 border-brand-500 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start justify-between">
              <div>
                <span className={selectedCase.type === 'missing' ? 'badge-missing' : 'badge-found'}>
                  {selectedCase.type}
                </span>
                <h4 className="text-base font-black text-slate-900 mt-1">{selectedCase.name}</h4>
                <p className="text-xs text-slate-500">{selectedCase.loc}</p>
                <div className="text-xs font-mono font-bold text-brand-600 mt-1">{selectedCase.case_num}</div>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="text-xs font-bold text-gray-400 hover:text-black"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
