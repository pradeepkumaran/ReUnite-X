import React from 'react';
import { ShieldCheck, Lock, AlertCircle, X } from 'lucide-react';

export default function ConsentModal({ isOpen, onClose, onAccept }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-brand-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Emergency Data Consent</h3>
              <p className="text-xs text-slate-500">Humanitarian Reunification Protocol</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-slate-600 leading-relaxed">
          <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-brand-900">
            <strong>Important Notice:</strong> You are submitting information to aid in disaster relief and family reunification.
          </div>

          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <span><strong>Data Privacy:</strong> Photographs and demographic data are processed strictly for finding missing persons. Photos are stored in encrypted private storage buckets.</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <span><strong>Minor Protection:</strong> Contact numbers and exact street addresses of minors (under 18) are never displayed in public directories.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <span><strong>Human Verification Gate:</strong> No case is ever finalized automatically by AI. Every candidate match is verified by a designated disaster authority officer.</span>
            </li>
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onAccept();
              onClose();
            }}
            className="btn-emergency text-sm py-2 px-5"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
}
