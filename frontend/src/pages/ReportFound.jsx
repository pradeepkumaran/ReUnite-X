import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HeartHandshake, 
  MapPin, 
  Camera, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import api from '../api/client';
import PhotoCapture from '../components/common/PhotoCapture';
import LocationPicker from '../components/common/LocationPicker';
import { useNetwork } from '../context/NetworkContext';
import { saveReportOffline } from '../db/indexedDB';

export default function ReportFound() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const { isOnline, setPendingCount } = useNetwork();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: '',
    approximate_age: '',
    gender: 'unknown',
    description: '',
    clothing_details: '',
    physical_marks: '',
    medical_notes: '',
    is_vulnerable: true,
    last_seen_address: 'Camp Delta 3 Relief Shelter',
    last_seen_lat: 10.7712,
    last_seen_lng: 79.8450,
    last_seen_time: new Date().toISOString().slice(0, 16),
    photo_file: null,
    photo_preview: null,
    contact_person_name: 'Relief Center Desk',
    contact_phone: '+919876543211',
    contact_relationship: 'Camp Volunteer / Officer',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLocationChange = (lat, lng, address) => {
    setFormData(prev => ({
      ...prev,
      last_seen_lat: lat,
      last_seen_lng: lng,
      last_seen_address: address
    }));
  };

  const handlePhotoSelected = (file, previewUrl) => {
    setFormData(prev => ({
      ...prev,
      photo_file: file,
      photo_preview: previewUrl
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const clientUuid = crypto.randomUUID();
    const payload = {
      type: 'found',
      client_case_uuid: clientUuid,
      disaster_id: 'd0000000-0000-0000-0000-000000000001',
      consent_given: true,
      person: {
        full_name: formData.full_name || 'Unidentified Individual',
        approximate_age: formData.approximate_age ? parseInt(formData.approximate_age) : null,
        gender: formData.gender,
        description: formData.description,
        clothing_details: formData.clothing_details,
        physical_marks: formData.physical_marks,
        last_seen_lat: formData.last_seen_lat,
        last_seen_lng: formData.last_seen_lng,
        last_seen_address: formData.last_seen_address,
        last_seen_time: formData.last_seen_time ? new Date(formData.last_seen_time).toISOString() : null,
        contact_person_name: formData.contact_person_name,
        contact_phone: formData.contact_phone,
        contact_relationship: formData.contact_relationship,
        medical_notes: formData.medical_notes,
        is_vulnerable: formData.is_vulnerable,
        vulnerability_reasons: ['found_unaccompanied']
      }
    };

    const queueLocally = async (serverCase = null) => {
      await saveReportOffline({
        clientCaseUuid: clientUuid,
        type: payload.type,
        disasterId: payload.disaster_id,
        consentGiven: payload.consent_given,
        person: payload.person,
        photoBlob: formData.photo_file,
        photoDataUrl: formData.photo_preview,
        fileName: formData.photo_file?.name || 'found-person.jpg',
        mimeType: formData.photo_file?.type || 'image/jpeg',
      });
      setPendingCount(prev => prev + 1);
      setIsSubmitting(false);
      setSubmissionSuccess({
        case_number: serverCase?.case_number || `OFFLINE-${clientUuid.slice(0, 8)}`,
        case_id: serverCase?.id,
        mode: serverCase ? 'photo_pending' : 'offline',
        full_name: payload.person.full_name
      });
    };

    if (!isOnline) {
      try {
        await queueLocally();
      } catch (err) {
        setIsSubmitting(false);
        alert(`Could not save this report on this device: ${err.message}`);
      }
      return;
    }

    try {
      const response = await api.post('/cases', payload);
      const createdCase = response.data;

      if (formData.photo_file && createdCase.id) {
        const photoData = new FormData();
        photoData.append('file', formData.photo_file);
        photoData.append('is_primary', 'true');
        try {
          await api.post(`/cases/${createdCase.id}/photos`, photoData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } catch (photoErr) {
          if (!photoErr.response) {
            await queueLocally(createdCase);
            return;
          }
          throw photoErr;
        }
      }

      setIsSubmitting(false);
      setSubmissionSuccess({
        case_number: createdCase.case_number,
        case_id: createdCase.id,
        mode: 'online',
        full_name: payload.person.full_name
      });
    } catch (err) {
      console.warn("Network or server unavailable, queuing found report locally in Dexie IndexedDB:", err);
      try {
        await queueLocally();
      } catch (storageError) {
        setIsSubmitting(false);
        console.error("Local storage error:", storageError);
        alert(`Storage error: ${storageError.message}`);
      }
    }
  };

  if (submissionSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">Found Person Registered</h2>
          <p className="text-sm text-slate-600">
            Case has been queued for background AI facial matching against all reported missing profiles.
          </p>
        </div>

        <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-200 space-y-2">
          <span className="text-xs uppercase font-bold text-slate-500">Official Case Tracking Number:</span>
          <div className="text-2xl font-black text-brand-700 tracking-wider font-mono">
            {submissionSuccess.case_number}
          </div>
          {submissionSuccess.mode !== 'online' && (
            <p className="text-xs font-semibold text-amber-700 pt-2">
              {submissionSuccess.mode === 'photo_pending'
                ? 'Report is online; its photo is saved locally and will sync when connectivity returns.'
                : 'Stored locally on this device. Will automatically sync to database when back online.'}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => navigate(`/tracker?q=${submissionSuccess.case_number}`)}
            className="btn-emergency w-full sm:w-auto text-sm py-3 px-6"
          >
            Track Status
          </button>
          <button
            onClick={() => {
              setSubmissionSuccess(null);
              setCurrentStep(1);
            }}
            className="btn-outline-emergency w-full sm:w-auto text-sm py-3 px-6"
          >
            File Another Found Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center space-y-2 mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
          <HeartHandshake className="w-3.5 h-3.5" /> Found Person Registration
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Report a Found / Unaccompanied Person</h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
          For relief camp officers, volunteers, and citizens who have located an unaccompanied child, elderly, or injured individual.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card-white space-y-6">
        {/* STEP 1: TRAITS */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-slate-900 border-b border-gray-100 pb-2">
              Step 1: Found Person Physical Profile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Name (or says name / Unknown)
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="e.g., Unidentified Boy (says Appu)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estimated Age
                </label>
                <input
                  type="number"
                  name="approximate_age"
                  min="0"
                  max="130"
                  value={formData.approximate_age}
                  onChange={handleChange}
                  placeholder="e.g., 8"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm bg-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Physical Marks / Scars / Distinctive Features
                </label>
                <input
                  type="text"
                  name="physical_marks"
                  value={formData.physical_marks}
                  onChange={handleChange}
                  placeholder="e.g., Small mark behind left ear"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clothing Worn When Found <span className="text-brand-600">*</span>
              </label>
              <input
                type="text"
                name="clothing_details"
                required
                value={formData.clothing_details}
                onChange={handleChange}
                placeholder="e.g., Mud-stained yellow t-shirt, blue shorts"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Condition & Medical Status
              </label>
              <input
                type="text"
                name="medical_notes"
                value={formData.medical_notes}
                onChange={handleChange}
                placeholder="e.g., Mild dehydration, received first aid treatment in relief camp"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="btn-emergency text-sm py-2.5 px-6 flex items-center gap-2"
              >
                Next: Current Shelter Location <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LOCATION & SHELTER */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-slate-900 border-b border-gray-100 pb-2">
              Step 2: Location Where Found / Current Shelter Camp
            </h3>

            <LocationPicker
              lat={formData.last_seen_lat}
              lng={formData.last_seen_lng}
              address={formData.last_seen_address}
              onLocationChange={handleLocationChange}
            />

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="btn-outline-emergency text-sm py-2 px-4 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="btn-emergency text-sm py-2.5 px-6 flex items-center gap-2"
              >
                Next: Take / Attach Photo <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PHOTO & SUBMIT */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-slate-900 border-b border-gray-100 pb-2">
              Step 3: Capture Face Photo for Vector Comparison
            </h3>

            <PhotoCapture
              onPhotoSelected={handlePhotoSelected}
              initialPreview={formData.photo_preview}
            />

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Camp Volunteer / In-Charge Phone
              </label>
              <input
                type="tel"
                name="contact_phone"
                required
                value={formData.contact_phone}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="btn-outline-emergency text-sm py-2 px-4 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-emergency text-base py-3 px-8 flex items-center gap-2 shadow-emergency-lg"
              >
                {isSubmitting ? 'Submitting Found Report...' : 'Register Found Individual'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
