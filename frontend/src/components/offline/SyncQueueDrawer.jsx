import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Trash2,
  X,
  Wifi,
  WifiOff
} from 'lucide-react';
import {
  getAllQueueCases,
  clearSyncedItems,
  OFFLINE_STATUS
} from '../../db/indexedDB';
import { syncManager } from '../../services/syncManager';
import { useNetwork } from '../../context/NetworkContext';

export default function SyncQueueDrawer({ isOpen, onClose }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isOnline, isSyncing } = useNetwork();

  const loadQueue = async () => {
    setLoading(true);
    try {
      const items = await getAllQueueCases();
      setQueue(items);
    } catch (err) {
      console.warn("Error loading Dexie queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadQueue();
    }
    // Subscribe to syncManager events to reload live
    const unsubscribe = syncManager.subscribe(() => {
      loadQueue();
    });
    return () => unsubscribe();
  }, [isOpen]);

  const handleManualSync = async () => {
    await syncManager.syncQueue();
    await loadQueue();
  };

  const handleClearSynced = async () => {
    await clearSyncedItems();
    await loadQueue();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-red-100 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-red-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">Offline Report Queue</h3>
            <p className="text-xs text-slate-500">IndexedDB local synchronization manager</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-black hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold">
            {isOnline ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5" /> Online
              </span>
            ) : (
              <span className="text-brand-600 flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5" /> Offline Mode
              </span>
            )}
            <span className="text-slate-400">•</span>
            <span className="text-slate-700">{queue.length} Total Reports</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearSynced}
              className="text-slate-500 hover:text-brand-600 flex items-center gap-1 font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Synced
            </button>
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="btn-emergency text-xs py-1 px-3 rounded-lg flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* List of Queue Items */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3">
          {queue.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs space-y-2">
              <Clock className="w-8 h-8 mx-auto text-slate-300" />
              <p>No offline reports queued.</p>
              <p className="text-[11px] text-slate-400">Reports submitted offline will appear here.</p>
            </div>
          ) : (
            queue.map((item) => (
              <div
                key={item.clientCaseUuid}
                className="p-3 rounded-xl border border-gray-200 bg-white hover:border-brand-300 shadow-sm transition space-y-2"
              >
                {/* Status Badges */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    UUID: {item.clientCaseUuid.slice(0, 8)}...
                  </span>

                  {item.status === OFFLINE_STATUS.SAVED_LOCALLY && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                      <Clock className="w-3 h-3 text-amber-600" /> Saved locally
                    </span>
                  )}
                  {item.status === OFFLINE_STATUS.SYNCING && (
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                      <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" /> Syncing
                    </span>
                  )}
                  {item.status === OFFLINE_STATUS.SYNCED && (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Synced
                    </span>
                  )}
                  {item.status === OFFLINE_STATUS.FAILED && (
                    <span className="inline-flex items-center gap-1 bg-red-50 text-brand-700 border border-red-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                      <XCircle className="w-3 h-3 text-brand-600" /> Failed
                    </span>
                  )}
                </div>

                {/* Person Item Details */}
                <div className="flex items-center gap-3">
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt="Thumbnail"
                      className="w-12 h-12 rounded-lg object-cover border border-red-100 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">
                      No Photo
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {item.person?.full_name || 'Unidentified'}
                    </h4>
                    <p className="text-[11px] text-slate-500 capitalize">
                      {item.type} • {item.person?.clothing_details || 'Clothing reported'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {item.serverCaseNumber && (
                  <div className="bg-emerald-50 p-1.5 rounded-lg text-[10px] font-mono text-emerald-900">
                    Server ID: <strong>{item.serverCaseNumber}</strong>
                  </div>
                )}

                {item.lastError && (
                  <div className="bg-red-50 p-1.5 rounded-lg text-[10px] text-brand-700">
                    Error: {item.lastError}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
