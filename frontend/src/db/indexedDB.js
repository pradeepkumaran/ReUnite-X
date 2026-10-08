import Dexie from 'dexie';

/**
 * REUNITE-X Offline Client Database
 * IndexedDB database powered by Dexie.js for resilient offline disaster reporting.
 */
export class ReuniteXDB extends Dexie {
  constructor() {
    super('ReuniteXDatabase');

    this.version(1).stores({
      pendingCases: '++id, clientCaseUuid, type, status, createdAt',
      pendingPhotos: '++id, clientCaseUuid, fileName, isPrimary, createdAt',
      syncStatus: 'key'
    });

    this.version(2).stores({
      pendingCases: '++id, clientCaseUuid, type, status, createdAt, retryCount',
      pendingPhotos: '++id, clientCaseUuid, fileName, isPrimary, createdAt',
      syncStatus: 'key'
    });
  }
}

export const db = new ReuniteXDB();

/**
 * Status Enums for UI Badges
 */
export const OFFLINE_STATUS = {
  SAVED_LOCALLY: 'saved_locally',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed'
};

/**
 * Inserts a new report into Dexie.js with binary photo blob.
 */
export async function saveReportOffline({
  clientCaseUuid,
  type,
  disasterId,
  consentGiven,
  person,
  photoBlob = null,
  photoDataUrl = null,
  fileName = 'photo.jpg',
  mimeType = 'image/jpeg'
}) {
  const now = new Date().toISOString();

  return db.transaction('rw', db.pendingCases, db.pendingPhotos, async () => {
    const caseId = await db.pendingCases.add({
      clientCaseUuid,
      type,
      disasterId: disasterId || 'd0000000-0000-0000-0000-000000000001',
      consentGiven,
      person,
      status: OFFLINE_STATUS.SAVED_LOCALLY,
      retryCount: 0,
      lastError: null,
      createdAt: now,
      syncedAt: null,
    });

    if (photoBlob || photoDataUrl) {
      await db.pendingPhotos.add({
        clientCaseUuid,
        fileName,
        mimeType,
        blob: photoBlob || null,
        previewDataUrl: photoDataUrl,
        isPrimary: true,
        createdAt: now
      });
    }

    return caseId;
  });
}

/**
 * Retrieves all cases waiting to be synced.
 */
export async function getUnsyncedCases() {
  return await db.pendingCases
    .where('status')
    .anyOf([OFFLINE_STATUS.SAVED_LOCALLY, OFFLINE_STATUS.FAILED])
    .toArray();
}

/**
 * Retrieves all pending cases including synced ones for queue audit.
 */
export async function getAllQueueCases() {
  const cases = await db.pendingCases.reverse().toArray();
  const photos = await db.pendingPhotos.toArray();

  // Attach photo preview to each case
  return cases.map(c => {
    const photo = photos.find(p => p.clientCaseUuid === c.clientCaseUuid);
    return {
      ...c,
      previewUrl: photo?.previewDataUrl || null
    };
  });
}

/**
 * Updates status of a pending case by client UUID.
 */
export async function updateCaseStatus(clientCaseUuid, status, extra = {}) {
  const found = await db.pendingCases.where({ clientCaseUuid }).first();
  if (found) {
    await db.pendingCases.update(found.id, {
      status,
      ...extra
    });
  }
}

/**
 * Clears successfully synced items from Dexie storage to free up space.
 */
export async function clearSyncedItems() {
  const syncedCases = await db.pendingCases.where({ status: OFFLINE_STATUS.SYNCED }).toArray();
  const uuids = syncedCases.map(c => c.clientCaseUuid);

  if (uuids.length) {
    await db.transaction('rw', db.pendingCases, db.pendingPhotos, async () => {
    await db.pendingCases.where('clientCaseUuid').anyOf(uuids).delete();
    await db.pendingPhotos.where('clientCaseUuid').anyOf(uuids).delete();
    });
  }
}
