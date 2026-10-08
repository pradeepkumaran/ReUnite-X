import React, { useState } from 'react';
import { MapPin, Navigation, Compass, AlertCircle } from 'lucide-react';

export default function LocationPicker({
  lat,
  lng,
  address,
  onLocationChange
}) {
  const [isLocating, setIsLocating] = useState(false);

  // Common relief sector presets for quick selection during disasters
  const presets = [
    { name: "Old Bus Stand Evacuation Point", lat: 10.7670, lng: 79.8410 },
    { name: "Camp Delta 3 Relief Shelter", lat: 10.7712, lng: 79.8450 },
    { name: "Coastal District Hospital Relief Ward", lat: 10.7656, lng: 79.8424 },
    { name: "Kumbakonam Bridge Relief Camp", lat: 10.9602, lng: 79.3845 },
  ];

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const userLat = parseFloat(pos.coords.latitude.toFixed(6));
        const userLng = parseFloat(pos.coords.longitude.toFixed(6));
        onLocationChange(userLat, userLng, address || "Current GPS Location");
      },
      (err) => {
        setIsLocating(false);
        console.warn("GPS error:", err);
        alert("Unable to retrieve GPS coordinates. Please select a preset or enter manually.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-slate-800">
          Last Seen Location / Shelter Point <span className="text-brand-600">*</span>
        </label>
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={isLocating}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 transition"
        >
          <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
          {isLocating ? 'Locating...' : 'Use My GPS'}
        </button>
      </div>

      <input
        type="text"
        required
        value={address || ''}
        onChange={(e) => onLocationChange(lat, lng, e.target.value)}
        placeholder="e.g., Old Bus Stand Relief Point, Nagapattinam or Camp Delta 3"
        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm transition"
      />

      {/* Preset Quick Select Pills */}
      <div>
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
          Quick Relief Shelter Presets:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onLocationChange(p.lat, p.lng, p.name)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                address === p.name
                  ? 'bg-brand-600 text-white border-brand-600 font-bold'
                  : 'bg-white text-slate-700 border-gray-200 hover:border-red-300 hover:bg-red-50'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Coordinates Display */}
      <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-xs text-slate-600">
        <Compass className="w-4 h-4 text-brand-600 flex-shrink-0" />
        <div className="flex items-center gap-4">
          <span>Lat: <strong className="text-slate-900">{lat ?? '—'}</strong></span>
          <span>Lng: <strong className="text-slate-900">{lng ?? '—'}</strong></span>
        </div>
      </div>
    </div>
  );
}
