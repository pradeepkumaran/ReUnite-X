import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUnsyncedCases } from '../db/indexedDB';
import { syncManager } from '../services/syncManager';

const NetworkContext = createContext(null);

export const NetworkProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState(null);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);

  const refreshPendingCount = async () => {
    try {
      const unsynced = await getUnsyncedCases();
      setPendingCount(unsynced.length);
    } catch (e) {
      console.warn("Could not check Dexie unsynced count:", e);
    }
  };

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatusMessage('Back online. Auto-synchronizing offline reports...');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatusMessage('Offline mode active. All reports saved locally in IndexedDB.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to syncManager events
    const unsubscribe = syncManager.subscribe((event, data) => {
      if (event === 'sync_start') {
        setIsSyncing(true);
        setSyncStatusMessage(`Syncing ${data.total} offline reports with central registry...`);
      } else if (event === 'sync_complete') {
        setIsSyncing(false);
        refreshPendingCount();
        setSyncStatusMessage(
          `Sync complete: ${data.synced_count} uploaded, ${data.conflict_count} conflicts resolved, ${data.failed_count} failed.`
        );
        setTimeout(() => setSyncStatusMessage(null), 4000);
      } else if (event === 'sync_failed') {
        setIsSyncing(false);
        refreshPendingCount();
        setSyncStatusMessage(`Sync failed: ${data.error}. Will retry automatically.`);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const toggleSimulateOffline = () => {
    setIsOnline(prev => !prev);
  };

  const triggerSync = async () => {
    if (!isOnline) {
      setSyncStatusMessage('Cannot sync while offline.');
      return;
    }
    await syncManager.syncQueue();
  };

  return (
    <NetworkContext.Provider value={{
      isOnline,
      toggleSimulateOffline,
      pendingCount,
      refreshPendingCount,
      isSyncing,
      syncStatusMessage,
      triggerSync,
      isQueueDrawerOpen,
      openQueueDrawer: () => setIsQueueDrawerOpen(true),
      closeQueueDrawer: () => setIsQueueDrawerOpen(false),
    }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
