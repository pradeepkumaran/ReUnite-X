import api from '../api/client';
import { retryDelay } from '../utils/retryDelay';
import {
  db,
  getUnsyncedCases,
  updateCaseStatus,
  OFFLINE_STATUS
} from '../db/indexedDB';

/**
 * Exponential backoff helper for network retries.
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('Could not read queued photo.'));
  reader.readAsDataURL(blob);
});

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.listeners = new Set();
    this.initAutoSync();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    this.listeners.forEach(fn => fn(event, data));
  }

  initAutoSync() {
    window.addEventListener('online', () => setTimeout(() => this.syncQueue(), 1500));
    window.addEventListener('load', () => this.syncQueue());
  }

  /**
   * Synchronizes all unsynced Dexie.js records to the FastAPI backend via /sync/batch.
   */
  async syncQueue() {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress.');
      return;
    }

    if (!navigator.onLine) {
      console.log('[SyncManager] Offline. Cannot sync.');
      return;
    }

    const unsynced = await getUnsyncedCases();
    if (unsynced.length === 0) {
      this.notify('sync_empty', { count: 0 });
      return;
    }

    this.isSyncing = true;
    this.notify('sync_start', { total: unsynced.length });

    // Mark cases as SYNCING in IndexedDB
    for (const c of unsynced) {
      await updateCaseStatus(c.clientCaseUuid, OFFLINE_STATUS.SYNCING);
    }

    // Build payload for /sync/batch
    const casesPayload = [];
    try {
      for (const c of unsynced) {
        const photo = await db.pendingPhotos.where({ clientCaseUuid: c.clientCaseUuid }).first();
        const photosPayload = [];
        if (photo) {
          const photoData = photo.blob ? await toDataUrl(photo.blob) : photo.previewDataUrl;
          photosPayload.push({
            client_photo_id: `${c.clientCaseUuid}-photo`,
            file_name: photo.fileName,
            mime_type: photo.mimeType,
            base64_data: photoData,
            is_primary: true
          });
        }

        casesPayload.push({
          client_case_uuid: c.clientCaseUuid,
          client_timestamp: c.createdAt,
          type: c.type,
          disaster_id: c.disasterId,
          consent_given: c.consentGiven,
          person: c.person,
          photos: photosPayload
        });
      }
    } catch (err) {
      for (const c of unsynced) {
        await updateCaseStatus(c.clientCaseUuid, OFFLINE_STATUS.FAILED, {
          retryCount: (c.retryCount || 0) + 1,
          lastError: err.message
        });
      }
      this.isSyncing = false;
      this.notify('sync_failed', { error: err.message });
      return;
    }

    const batchRequest = {
      cases: casesPayload,
      device_id: navigator.userAgent.slice(0, 50),
      app_version: '1.0.0-pwa'
    };

    // Retry loop with exponential backoff (max 3 retries)
    let attempt = 0;
    const maxAttempts = 4;
    let syncSuccess = false;
    let syncResponse = null;

    while (attempt < maxAttempts && !syncSuccess) {
      attempt++;
      try {
        console.log(`[SyncManager] Dispatching POST /sync/batch (attempt ${attempt}/${maxAttempts})...`);
        const res = await api.post('/sync/batch', batchRequest);
        syncResponse = res.data;
        syncSuccess = true;
      } catch (err) {
        console.warn(`[SyncManager] Attempt ${attempt} failed: ${err.message}`);
        if (attempt < maxAttempts) {
          const delayMs = retryDelay(attempt);
          await wait(delayMs);
        } else {
          // All attempts failed: mark records as FAILED in Dexie
          for (const c of unsynced) {
            await updateCaseStatus(c.clientCaseUuid, OFFLINE_STATUS.FAILED, {
              retryCount: (c.retryCount || 0) + 1,
              lastError: err.message
            });
          }
          this.isSyncing = false;
          this.notify('sync_failed', { error: err.message });
          return;
        }
      }
    }

    // Update statuses based on batch response
    if (syncResponse && syncResponse.results) {
      for (const resItem of syncResponse.results) {
        const clientUuid = resItem.client_case_uuid;
        if (resItem.status === 'synced' || resItem.status === 'conflict_resolved') {
          await updateCaseStatus(clientUuid, OFFLINE_STATUS.SYNCED, {
            syncedAt: new Date().toISOString(),
            serverCaseId: resItem.server_case_id,
            serverCaseNumber: resItem.case_number,
            resolution: resItem.resolution_applied
          });
        } else {
          await updateCaseStatus(clientUuid, OFFLINE_STATUS.FAILED, {
            lastError: resItem.error || 'Server rejected item'
          });
        }
      }
    }

    this.isSyncing = false;
    this.notify('sync_complete', syncResponse);
  }
}

export const syncManager = new SyncManager();
