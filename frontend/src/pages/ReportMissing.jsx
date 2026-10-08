import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, 
  MapPin, 
  Camera, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import api from '../api/client';
import PhotoCapture from '../components/common/PhotoCapture';
import LocationPicker from '../components/common/LocationPicker';
import ConsentModal from '../components/common/ConsentModal';
import { useNetwork } from '../context/NetworkContext';
import { saveReportOffline } from '../db/indexedDB';

export default function ReportMissing() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const { isOnline, setPendingCount } = useNetwork();
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Person details
    full_name: '',
    approximate_age: '',
    gender: 'unknown',
    description: '',
    clothing_details: '',
    physical_marks: '',
    medical_notes: '',
    is_vulnerable: false,
    // Step 2: Location & Time
    last_seen_address: 'Old Bus Stand Evacuation Point',
    last_seen_lat: 10.7670,
    last_seen_lng: 79.8410,
    last_seen_time: new Date().toISOString().slice(0, 16),
    // Step 3: Photo
    photo_file: null,
    photo_preview: null,
    // Step 4: Reporter details & consent
    contact_person_name: '',
    contact_phone: '',
    contact_email: '',
    contact_relationship: '',
    consent_given: true,
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
      type: 'missing',
      client_case_uuid: clientUuid,
      disaster_id: 'd0000000-0000-0000-0000-000000000001',
      consent_given: formData.consent_given,
      person: {
        full_name: formData.full_name,
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
        contact_email: formData.contact_email,
        contact_relationship: formData.contact_relationship,
        medical_notes: formData.medical_notes,
        is_vulnerable: formData.is_vulnerable || (parseInt(formData.approximate_age) < 18),
        vulnerability_reasons: formData.is_vulnerable ? ['medical_attention_required'] : []
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
        fileName: formData.photo_file?.name || 'missing-person.jpg',
        mimeType: formData.photo_file?.type || 'image/jpeg',
      });
      setPendingCount(prev => prev + 1);
      setIsSubmitting(false);
      setSubmissionSuccess({
        case_number: serverCase?.case_number || `OFFLINE-${clientUuid.slice(0, 8)}`,
        case_id: serverCase?.id,
        mode: serverCase ? 'photo_pending' : 'offline',
        full_name: formData.full_name
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

      // If photo attached, upload it
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
        full_name: formData.full_name
      });
    } catch (err) {
      if (!err.response) {
        try {
          await queueLocally();
          return;
        } catch (storageError) {
          alert(`Network failed and this report could not be saved locally: ${storageError.message}`);
        }
      }
      setIsSubmitting(false);
      console.error("Submission failed:", err);
      alert("Error submitting report. Please verify connection and details.");
    }
  };

  if (submissionSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">Missing Person Report Registered</h2>
          <p className="text-sm text-slate-600">
            Case for <strong>{submissionSuccess.full_name}</strong> has been logged into the disaster coordination registry.
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
                : 'Stored locally on this device. Will automatically sync to central database when back online.'}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => navigate(`/tracker?q=${submissionSuccess.case_number}`)}
            className="btn-emergency w-full sm:w-auto text-sm py-3 px-6"
          >
            Track This Case
          </button>
          <button
            onClick={() => {
              setSubmissionSuccess(null);
              setCurrentStep(1);
            }}
            className="btn-outline-emergency w-full sm:w-auto text-sm py-3 px-6"
          >
            File Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center space-y-2 mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-brand-700 border border-red-200">
          <UserPlus className="w-3.5 h-3.5" /> Missing Person Intake
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Report a Missing Person</h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
          Please provide as much physical detail and visual evidence as possible to maximize AI face matching accuracy.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="grid grid-cols-4 gap-2 mb-8 text-center">
        {[
          { step: 1, label: 'Physical Traits' },
          { step: 2, label: 'Last Seen Point' },
          { step: 3, label: 'Photo Intake' },
          { step: 4, label: 'Contact & Consent' },
        ].map((s) => (
          <div
            key={s.step}
            className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
              currentStep === s.step
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : currentStep > s.step
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-400 border-gray-200'
            }`}
          >
            <span className="block text-sm font-black">{s.step}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="card-white space-y-6">
        {/* STEP 1: PHYSICAL TRAITS */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-slate-900 border-b border-gray-100 pb-2">
              Step 1: Missing Individual Profile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name / Responds to Name <span className="text-brand-600">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="e.g., Aarav Sharma or Appu"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Approximate Age <span className="text-brand-600">*</span>
                </label>
                <input
                  type="number"
                  name="approximate_age"
                  required
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
                  <option value="unknown">Unknown / Not Specified</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Physical Scars / Tattoos / Distinctive Marks
                </label>
                <input
                  type="text"
                  name="physical_marks"
                  value={formData.physical_marks}
                  onChange={handleChange}
                  placeholder="e.g., Small birthmark behind left ear"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clothing Worn When Last Seen <span className="text-brand-600">*</span>
              </label>
              <input
                type="text"
                name="clothing_details"
                required
                value={formData.clothing_details}
                onChange={handleChange}
                placeholder="e.g., Yellow cartoon t-shirt, blue denim shorts, white sneakers"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Physical Traits Description
              </label>
              <textarea
                name="description"
                rows="2"
                value={formData.description}
                onChange={handleChange}
                placeholder="e.g., Fair complexion, curly dark hair, responds when called Appu..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
              />
            </div>

            <div className="bg-red-50 p-3.5 rounded-xl border border-red-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_vulnerable"
                  checked={formData.is_vulnerable}
                  onChange={handleChange}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                />
                <span className="text-xs font-bold text-brand-900">
                  Critical Vulnerability (Medical Condition / Chronic Medication Needed)
                </span>
              </label>
              {formData.is_vulnerable && (
                <input
                  type="text"
                  name="medical_notes"
                  value={formData.medical_notes}
                  onChange={handleChange}
                  placeholder="e.g., Requires daily asthma inhaler or insulin medication"
                  className="w-full px-3 py-2 rounded-lg border border-red-300 bg-white text-xs outline-none"
                />
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                disabled={!formData.full_name || !formData.approximate_age || !formData.clothing_details}
                onClick={() => setCurrentStep(2)}
                className="btn-emergency text-sm py-2.5 px-6 flex items-center gap-2"
              >
                Next: Location Details <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LOCATION & TIME */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-slate-900 border-b border-gray-100 pb-2">
              Step 2: Last Known Point & Disaster Zone
            </h3>

            <LocationPicker
              lat={formData.last_seen_lat}
              lng={formData.last_seen_lng}
              address={formData.last_seen_address}
              onLocationChange={handleLocationChange}
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Approximate Date & Time Separated <span className="text-brand-600">*</span>
              </label>
              <input
                type="datetime-local"
                name="last_seen_time"
                required
                value={formData.last_seen_time}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm bg-white"
              />
            </div>

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
                Next: Photo Intake <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PHOTO INTAKE */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-slate-900 border-b border-gray-100 pb-2">
              Step 3: Visual Photograph for AI Facial Vector Matching
            </h3>

            <PhotoCapture
              onPhotoSelected={handlePhotoSelected}
              initialPreview={formData.photo_preview}
            />

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-800">
              <strong>Tip:</strong> If you do not have a photo right now, you may still proceed. The case will be searchable via clothing, physical traits, and last seen point.
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
                type="button"
                onClick={() => setCurrentStep(4)}
                className="btn-emergency text-sm py-2.5 px-6 flex items-center gap-2"
              >
                Next: Reporter Details <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CONTACT & CONSENT */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-slate-900 border-b border-gray-100 pb-2">
              Step 4: Contact Information & Consent
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your Full Name (Reporter) <span className="text-brand-600">*</span>
                </label>
                <input
                  type="text"
                  name="contact_person_name"
                  required
                  value={formData.contact_person_name}
                  onChange={handleChange}
                  placeholder="e.g., Ananya Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Relationship to Person <span className="text-brand-600">*</span>
                </label>
                <input
                  type="text"
                  name="contact_relationship"
                  required
                  value={formData.contact_relationship}
                  onChange={handleChange}
                  placeholder="e.g., Mother / Father / Brother"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Phone Number <span className="text-brand-600">*</span>
                </label>
                <input
                  type="tel"
                  name="contact_phone"
                  required
                  value={formData.contact_phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address (For Match Alerts)
                </label>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  placeholder="family@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-red-200 outline-none text-sm"
                />
              </div>
            </div>

            {/* Consent Box */}
            <div className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent_given"
                  checked={formData.consent_given}
                  onChange={handleChange}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 mt-0.5"
                />
                <span className="text-xs text-brand-950 font-medium leading-relaxed">
                  I formally authorize the emergency response coordination team to process these details and photograph for the strict purpose of humanitarian reunification under the Disaster Management Framework.
                </span>
              </label>
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowConsentModal(true)}
                  className="text-xs text-brand-700 font-bold underline hover:text-brand-900"
                >
                  Read Full Consent Policy & Minor Protection Protocol
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="btn-outline-emergency text-sm py-2 px-4 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.consent_given || !formData.contact_person_name || !formData.contact_phone}
                className="btn-emergency text-base py-3 px-8 flex items-center gap-2 shadow-emergency-lg"
              >
                {isSubmitting ? 'Registering Report...' : 'Submit Missing Report'}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Consent Modal Dialog */}
      <ConsentModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        onAccept={() => setFormData(p => ({ ...p, consent_given: true }))}
      />
    </div>
  );
}
