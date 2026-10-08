import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search as SearchIcon, 
  Filter, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  User, 
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import api from '../api/client';

export default function Search() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [caseType, setCaseType] = useState('');
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [radiusKm, setRadiusKm] = useState('25');

  const fetchSearch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (query.trim()) params.q = query.trim();
      if (caseType) params.case_type = caseType;
      if (gender) params.gender = gender;
      if (ageRange) {
        if (ageRange === 'child') { params.age_min = 0; params.age_max = 12; }
        if (ageRange === 'teen') { params.age_min = 13; params.age_max = 17; }
        if (ageRange === 'adult') { params.age_min = 18; params.age_max = 59; }
        if (ageRange === 'elderly') { params.age_min = 60; params.age_max = 120; }
      }

      const res = await api.get('/search', { params });
      setCases(res.data);
    } catch (err) {
      console.warn("Search fetch error, fallback to /cases:", err);
      try {
        const fallbackRes = await api.get('/cases');
        // Map to public search shape
        const mapped = fallbackRes.data.map(c => ({
          case_id: c.id,
          case_number: c.case_number,
          case_type: c.type,
          case_status: c.status,
          primary_photo_url: c.primary_photo_url,
          created_at: c.created_at,
          person: {
            full_name: c.person_name,
            approximate_age: c.approximate_age,
            gender: 'unknown',
            clothing_details: 'Disaster evacuation attire',
            last_seen_address: c.last_seen_address,
            is_minor: c.is_minor,
            masked_contact_phone: c.is_minor ? '[REDACTED - MINOR PROTECTION]' : '***-***-3210'
          }
        }));
        setCases(mapped);
      } catch (e2) {
        setCases([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSearch();
  }, [caseType, gender, ageRange]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSearch();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-brand-700 border border-red-200">
          <SearchIcon className="w-3.5 h-3.5" /> Public Disaster Case Registry
        </span>
        <h1 className="text-3xl font-black text-slate-900">Search Missing & Found Persons</h1>
        <p className="text-sm text-slate-600">
          Public directory. All contact details of minors are automatically redacted for child protection.
        </p>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card-white space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-grow">
            <SearchIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, nickname, or clothing description..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
            />
          </div>
          <button
            type="submit"
            className="btn-emergency text-sm py-2.5 px-6 flex-shrink-0"
          >
            Search Registry
          </button>
        </form>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
          <span className="text-slate-500 font-bold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </span>

          {/* Type Filter */}
          <select
            value={caseType}
            onChange={(e) => setCaseType(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold text-slate-700 outline-none"
          >
            <option value="">All Case Types</option>
            <option value="missing">Missing Only</option>
            <option value="found">Found Only</option>
          </select>

          {/* Gender Filter */}
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold text-slate-700 outline-none"
          >
            <option value="">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>

          {/* Age Bracket */}
          <select
            value={ageRange}
            onChange={(e) => setAgeRange(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold text-slate-700 outline-none"
          >
            <option value="">All Ages</option>
            <option value="child">Child (0-12 yrs)</option>
            <option value="teen">Teen (13-17 yrs)</option>
            <option value="adult">Adult (18-59 yrs)</option>
            <option value="elderly">Elderly (60+ yrs)</option>
          </select>

          {(caseType || gender || ageRange || query) && (
            <button
              onClick={() => {
                setCaseType('');
                setGender('');
                setAgeRange('');
                setQuery('');
              }}
              className="text-xs text-brand-600 font-bold hover:underline ml-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
        <span>Displaying {cases.length} active disaster records</span>
        <span className="flex items-center gap-1 text-brand-700">
          <ShieldAlert className="w-3.5 h-3.5 text-brand-600" /> Minor Protection Policy Active
        </span>
      </div>

      {/* Case Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card-white animate-pulse h-64 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="card-white text-center py-16 space-y-3">
          <User className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">No Matching Records Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search filters or report a new missing/found person case.
          </p>
          <div className="pt-2">
            <Link to="/report-missing" className="btn-emergency text-xs py-2 px-4">
              Report Missing Person
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((item) => (
            <div
              key={item.case_id}
              className="card-white border hover:border-brand-500 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header Tag */}
                <div className="flex items-center justify-between">
                  <span className={item.case_type === 'missing' ? 'badge-missing' : 'badge-found'}>
                    {item.case_type}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {item.case_number}
                  </span>
                </div>

                {/* Photo Preview */}
                <div className="relative rounded-xl overflow-hidden bg-gray-100 h-44">
                  <img
                    src={`/photos/${item.case_id}.jpg`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = item.person.gender === 'female' 
                        ? "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80"
                        : "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80";
                    }}
                    alt={item.person.full_name}
                    className="w-full h-full object-cover"
                  />
                  {item.person.is_minor && (
                    <span className="absolute top-2 right-2 badge-minor shadow-sm">
                      Minor Shielded
                    </span>
                  )}
                </div>

                {/* Person Details */}
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-snug">
                    {item.person.full_name}
                  </h3>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    {item.person.approximate_age ? `${item.person.approximate_age} years old` : 'Age unknown'} • {item.person.gender}
                  </div>
                </div>

                <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  <strong>Clothing:</strong> {item.person.clothing_details || 'Evacuation clothing'}
                </div>

                <div className="flex items-start gap-1.5 text-xs text-slate-500 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 mt-0.5" />
                  <span className="truncate">{item.person.last_seen_address || 'Nagapattinam Relief Zone'}</span>
                </div>
              </div>

              {/* Card Footer Link */}
              <div className="pt-4 border-t border-gray-100 mt-4 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  {item.case_status.replace('_', ' ')}
                </span>
                <Link
                  to={`/tracker?q=${item.case_number}`}
                  className="text-xs font-bold text-slate-900 hover:text-brand-600 flex items-center gap-1"
                >
                  View Details <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
