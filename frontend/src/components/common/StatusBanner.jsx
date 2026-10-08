import React from 'react';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useNetwork } from '../../context/NetworkContext';

export default function StatusBanner() {
  const { isOnline, pendingCount, isSyncing, syncStatusMessage, triggerSync } = useNetwork();

  if (isOnline && pendingCount === 0 && !syncStatusMessage) {
    return null;
  }

  return (
    <div className="w-full">
      {!isOnline && (
        <div className="bg-red-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-4xl mx-auto text-sm font-semibold">
            <WifiOff className="w-5 h-5 flex-shrink-0 animate-pulse text-yellow-300" />
            <span>
              <strong>OFFLINE MODE:</strong> No internet detected. New missing & found reports are securely stored on your local device (IndexedDB) and will auto-sync when connection restores.
            </span>
          </div>
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2 shadow-sm flex items-center justify-between">
          <div className="flex items-center justify-between max-w-7xl mx-auto w-full text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-900" />
              <span>
                <strong>{pendingCount} offline reports</strong> waiting to be uploaded to the central database.
              </span>
            </div>
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-slate-800 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      )}

      {syncStatusMessage && (
        <div className="bg-slate-900 text-white text-xs py-1.5 px-4 text-center font-medium">
          {syncStatusMessage}
        </div>
      )}
    </div>
  );
}
