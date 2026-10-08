import React, { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function PhotoCapture({ onPhotoSelected, initialPreview = null }) {
  const [preview, setPreview] = useState(initialPreview);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.warn("Camera access denied or unavailable:", err);
      alert("Unable to access camera. Please upload an image file instead.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    const base64Data = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(base64Data);
    stopCamera();

    // Convert to mock File
    canvas.toBlob((blob) => {
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onPhotoSelected(file, base64Data);
    }, 'image/jpeg');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file (JPEG, PNG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
      onPhotoSelected(file, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPreview(null);
    stopCamera();
    onPhotoSelected(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full space-y-3">
      <label className="block text-sm font-bold text-slate-800">
        Photograph of Person <span className="text-brand-600">*</span>
      </label>

      {/* Camera Live Stream */}
      {cameraActive ? (
        <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-brand-600 shadow-emergency max-w-sm mx-auto">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-72 object-cover"
          />
          {/* Face Guideline Oval Overlay */}
          <div className="absolute inset-0 border-2 border-dashed border-white/60 rounded-full m-8 pointer-events-none flex items-center justify-center">
            <span className="text-white/80 text-[10px] uppercase font-bold tracking-widest bg-black/40 px-2 py-0.5 rounded">
              Position Face Inside Oval
            </span>
          </div>

          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={capturePhoto}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-5 rounded-full shadow-lg flex items-center gap-1.5 text-sm"
            >
              <Camera className="w-4 h-4" /> Snap Photo
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-white/80 hover:bg-white text-slate-900 font-bold py-2 px-4 rounded-full text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : preview ? (
        /* Preview Card */
        <div className="relative rounded-2xl overflow-hidden border-2 border-red-200 bg-white max-w-sm mx-auto p-2">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-64 object-cover rounded-xl"
          />
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Photo Attached
            </span>
            <button
              type="button"
              onClick={clearPhoto}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800"
            >
              Change Photo
            </button>
          </div>
        </div>
      ) : (
        /* Upload / Take Photo Action Area */
        <div className="border-2 border-dashed border-red-200 hover:border-brand-500 rounded-2xl p-6 bg-red-50/40 text-center transition">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 text-brand-600 flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Attach or Take a Photo</p>
              <p className="text-xs text-slate-500 mt-0.5">Clear frontal view gives the highest AI face-matching accuracy</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={startCamera}
                className="btn-outline-emergency text-xs py-2 px-4 flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" /> Use Camera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-emergency text-xs py-2 px-4 flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" /> Upload File
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
  );
}
