import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Radio } from 'lucide-react';
import api from '../api/client';

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.reuniteGoogleMapsPromise) return window.reuniteGoogleMapsPromise;
  window.reuniteGoogleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsKey)}`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Google Maps could not be loaded.'));
    document.head.appendChild(script);
  });
  return window.reuniteGoogleMapsPromise;
}

export default function MapView() {
  const mapContainer = useRef(null);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [provider, setProvider] = useState(import.meta.env.VITE_MAP_PROVIDER || 'mapbox');
  const [mapError, setMapError] = useState('');
  const geojson = useMemo(() => ({
    type: 'FeatureCollection',
    features: cases.filter(item => Number.isFinite(item.last_seen_lat) && Number.isFinite(item.last_seen_lng))
      .map(item => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.last_seen_lng, item.last_seen_lat] },
        properties: {
          id: item.id,
          case_number: item.case_number,
          name: item.person_name,
          type: item.type,
          status: item.status,
          is_minor: item.is_minor,
        },
      })),
  }), [cases]);

  useEffect(() => {
    let active = true;
    api.get('/cases')
      .then(response => { if (active) setCases(response.data); })
      .catch(() => { if (active) setMapError('Case locations could not be loaded. Please retry when connected.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return undefined;
    let map;
    let googleMarkers = [];
    let active = true;

    if (provider === 'mapbox') {
      if (!mapboxToken) {
        setMapError('Configure VITE_MAPBOX_ACCESS_TOKEN to enable the interactive Mapbox map.');
        return undefined;
      }
      import('../services/mapbox').then(({ default: mapboxgl }) => {
        if (!active || !mapContainer.current) return;
        mapboxgl.accessToken = mapboxToken;
        map = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [79.8424, 10.7656],
          zoom: 10,
        });
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.on('load', () => {
        map.addSource('cases', { type: 'geojson', data: geojson, cluster: true, clusterRadius: 48 });
        map.addLayer({
          id: 'case-clusters', type: 'circle', source: 'cases', filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#b91c1c',
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 30, 32],
            'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff',
          },
          });
        }).catch(error => setMapError(error.message));
        map.addLayer({
          id: 'case-cluster-count', type: 'symbol', source: 'cases', filter: ['has', 'point_count'],
          layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 13 },
          paint: { 'text-color': '#ffffff' },
        });
        map.addLayer({
          id: 'case-points', type: 'circle', source: 'cases', filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': 9,
            'circle-color': ['match', ['get', 'type'], 'found', '#047857', '#b91c1c'],
            'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff',
          },
        });
        map.on('click', 'case-clusters', event => {
          const feature = map.queryRenderedFeatures(event.point, { layers: ['case-clusters'] })[0];
          map.getSource('cases').getClusterExpansionZoom(feature.properties.cluster_id, (error, zoom) => {
            if (!error) map.easeTo({ center: feature.geometry.coordinates, zoom });
          });
        });
        map.on('click', 'case-points', event => {
          const properties = event.features[0].properties;
          setSelectedCase(cases.find(item => item.id === properties.id) || null);
        });
        map.on('mouseenter', 'case-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'case-clusters', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'case-points', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'case-points', () => { map.getCanvas().style.cursor = ''; });
      });
    } else if (!googleMapsKey) {
      setMapError('Configure VITE_GOOGLE_MAPS_API_KEY to use Google Maps.');
      return undefined;
    } else {
      loadGoogleMaps().then(maps => {
        if (!active || !mapContainer.current) return;
        map = new maps.Map(mapContainer.current, {
          center: { lat: 10.7656, lng: 79.8424 }, zoom: 10, mapTypeControl: false,
        });
        googleMarkers = geojson.features.map(feature => {
          const marker = new maps.Marker({
            position: { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] },
            map,
            title: `${feature.properties.type} case ${feature.properties.case_number}`,
            label: feature.properties.type === 'found' ? 'F' : 'M',
          });
          marker.addListener('click', () => {
            setSelectedCase(cases.find(item => item.id === feature.properties.id) || null);
          });
          return marker;
        });
      }).catch(error => setMapError(error.message));
    }

    return () => {
      active = false;
      googleMarkers.forEach(marker => marker.setMap(null));
      map?.remove?.();
    };
  }, [provider, geojson]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="card-white border-l-8 border-l-brand-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-brand-600" />
            <h1 className="text-2xl font-black text-slate-900">Disaster response map</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">Clustered missing and found reports. Minor locations are restricted to authorized responders.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Map provider
          <select
            value={provider}
            onChange={event => { setMapError(''); setProvider(event.target.value); }}
            className="rounded-lg border border-slate-300 px-3 py-2"
            aria-label="Map provider"
          >
            <option value="mapbox">Mapbox GL</option>
            <option value="google">Google Maps</option>
          </select>
        </label>
      </header>

      {mapError && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{mapError}</p>}
      <div ref={mapContainer} className="h-[60vh] min-h-96 rounded-2xl border border-slate-300 bg-slate-100" aria-label="Map of reported case locations" />
      <div className="card-white flex flex-wrap gap-5 text-sm">
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-brand-700" /> Missing</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-700" /> Found</span>
        <span className="flex items-center gap-2 text-slate-600"><Radio size={16} /> Map tiles may be unavailable offline; report queue remains available.</span>
      </div>
      {selectedCase && (
        <section className="card-white" aria-live="polite">
          <div className="flex justify-between gap-3">
            <div>
              <span className={selectedCase.type === 'missing' ? 'badge-missing' : 'badge-found'}>{selectedCase.type}</span>
              <h2 className="font-bold mt-2">{selectedCase.is_minor ? 'Protected person' : selectedCase.person_name}</h2>
              <p className="text-sm text-slate-600">{selectedCase.last_seen_address || 'Location available to authorized responders only'}</p>
              <p className="font-mono text-xs mt-1">{selectedCase.case_number} · {selectedCase.status.replaceAll('_', ' ')}</p>
            </div>
            <button className="btn-outline-emergency self-start" onClick={() => setSelectedCase(null)}>Close</button>
          </div>
        </section>
      )}
      {geojson.features.length === 0 && (
        <p className="text-sm text-slate-600">No report coordinates are available to this account. Exact locations of minors are visible only to authorities and volunteers.</p>
      )}
    </div>
  );
}
