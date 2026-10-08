import React, { createContext, useContext, useState, useEffect } from 'react';

const NetworkContext = createContext(null);

export const NetworkProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatusMessage('Back online. Ready to synchronize.');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatusMessage('Offline mode active. All reports saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = async () => {
    if (!isOnline) {
      setSyncStatusMessage('Cannot sync while offline.');
      return;
    }
    setIsSyncing(true);
    setSyncStatusMessage('Syncing offline reports with central disaster database...');
    setTimeout(() => {
      setIsSyncing(false);
      setPendingCount(0);
      setSyncStatusMessage('All reports successfully synchronized.');
      setTimeout(() => setSyncStatusMessage(null), 4000);
    }, 1200);
  };

  return (
    <NetworkContext.Provider value={{
      isOnline,
      pendingCount,
      setPendingCount,
      isSyncing,
      syncStatusMessage,
      triggerSync
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
