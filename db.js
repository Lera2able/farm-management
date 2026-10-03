// IndexedDB Wrapper for Offline Storage
class LivestockDB {
    constructor() {
        this.dbName = 'LivestockAttendanceDB';
        this.version = 2;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Attendance records store
                if (!db.objectStoreNames.contains('attendance')) {
                    const attendanceStore = db.createObjectStore('attendance', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    attendanceStore.createIndex('timestamp', 'timestamp', { unique: false });
                    attendanceStore.createIndex('synced', 'synced', { unique: false });
                }

                // Shepherd info store
                if (!db.objectStoreNames.contains('shepherd')) {
                    db.createObjectStore('shepherd', { keyPath: 'id' });
                }

                // Pending actions store (add, sold/died)
                if (!db.objectStoreNames.contains('pendingActions')) {
                    const pendingStore = db.createObjectStore('pendingActions', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    pendingStore.createIndex('type', 'type', { unique: false });
                    pendingStore.createIndex('synced', 'synced', { unique: false });
                }
                const pendingStore = event.target.transaction.objectStore('pendingActions');
                if (!pendingStore.indexNames.contains('syncStatus')) {
                    pendingStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                }

                // Local livestock state (current session)
                if (!db.objectStoreNames.contains('localState')) {
                    db.createObjectStore('localState', { keyPath: 'livestockId' });
                }

                // Cached shared data for offline reads
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'key' });
                }

                // Photo/voice scan drafts kept safely on device until processed
                if (!db.objectStoreNames.contains('scanDrafts')) {
                    const draftStore = db.createObjectStore('scanDrafts', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    draftStore.createIndex('kind', 'kind', { unique: false });
                    draftStore.createIndex('status', 'status', { unique: false });
                    draftStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }

    buildSyncMeta(overrides = {}) {
        return {
            synced: false,
            syncStatus: 'pending',
            syncAttempts: 0,
            lastSyncError: '',
            queuedAt: Date.now(),
            lastSyncAt: null,
            ...overrides
        };
    }

    // Save shepherd name
    async saveShepherd(name) {
        const tx = this.db.transaction(['shepherd'], 'readwrite');
        const store = tx.objectStore('shepherd');
        await store.put({ id: 'current', name, timestamp: Date.now() });
        return tx.complete;
    }

    // Get shepherd name
    async getShepherd() {
        const tx = this.db.transaction(['shepherd'], 'readonly');
        const store = tx.objectStore('shepherd');
        return await store.get('current');
    }

    // Save attendance record
    async saveAttendance(shepherdName, presentLivestock, timestamp = Date.now()) {
        const tx = this.db.transaction(['attendance'], 'readwrite');
        const store = tx.objectStore('attendance');
        
        const record = {
            shepherdName,
            presentLivestock, // Array of livestock IDs that were marked present
            timestamp,
            date: new Date(timestamp).toISOString().split('T')[0],
            ...this.buildSyncMeta()
        };
        
        await store.add(record);
        return tx.complete;
    }

    // Get unsynced attendance records
    async getUnsyncedAttendance() {
        const tx = this.db.transaction(['attendance'], 'readonly');
        const store = tx.objectStore('attendance');
        const index = store.index('synced');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(false);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Mark attendance as synced
    async markAttendanceSynced(id) {
        const tx = this.db.transaction(['attendance'], 'readwrite');
        const store = tx.objectStore('attendance');
        
        const record = await store.get(id);
        if (record) {
            record.synced = true;
            record.syncStatus = 'synced';
            record.lastSyncError = '';
            record.lastSyncAt = Date.now();
            await store.put(record);
        }
        return tx.complete;
    }

    async markAttendanceFailed(id, error) {
        const tx = this.db.transaction(['attendance'], 'readwrite');
        const store = tx.objectStore('attendance');
        const record = await store.get(id);
        if (record) {
            record.synced = false;
            record.syncStatus = 'failed';
            record.syncAttempts = (record.syncAttempts || 0) + 1;
            record.lastSyncError = String(error || 'sync failed');
            record.lastSyncAt = Date.now();
            await store.put(record);
        }
        return tx.complete;
    }

    async markAttendanceSyncing(id) {
        const tx = this.db.transaction(['attendance'], 'readwrite');
        const store = tx.objectStore('attendance');
        const record = await store.get(id);
        if (record) {
            record.syncStatus = 'syncing';
            record.syncAttempts = (record.syncAttempts || 0) + 1;
            record.lastSyncAt = Date.now();
            await store.put(record);
        }
        return tx.complete;
    }

    // Save pending action (add new livestock, sold/died)
    async savePendingAction(type, data) {
        const tx = this.db.transaction(['pendingActions'], 'readwrite');
        const store = tx.objectStore('pendingActions');
        
        const action = {
            type, // 'add_livestock', 'sold', 'died'
            data,
            timestamp: Date.now(),
            ...this.buildSyncMeta()
        };
        
        await store.add(action);
        return tx.complete;
    }

    // Get unsynced pending actions
    async getUnsyncedActions() {
        const tx = this.db.transaction(['pendingActions'], 'readonly');
        const store = tx.objectStore('pendingActions');
        const index = store.index('synced');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(false);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Mark action as synced
    async markActionSynced(id) {
        const tx = this.db.transaction(['pendingActions'], 'readwrite');
        const store = tx.objectStore('pendingActions');
        
        const record = await store.get(id);
        if (record) {
            record.synced = true;
            record.syncStatus = 'synced';
            record.lastSyncError = '';
            record.lastSyncAt = Date.now();
            await store.put(record);
        }
        return tx.complete;
    }

    async markActionFailed(id, error) {
        const tx = this.db.transaction(['pendingActions'], 'readwrite');
        const store = tx.objectStore('pendingActions');
        const record = await store.get(id);
        if (record) {
            record.synced = false;
            record.syncStatus = 'failed';
            record.syncAttempts = (record.syncAttempts || 0) + 1;
            record.lastSyncError = String(error || 'sync failed');
            record.lastSyncAt = Date.now();
            await store.put(record);
        }
        return tx.complete;
    }

    async markActionSyncing(id) {
        const tx = this.db.transaction(['pendingActions'], 'readwrite');
        const store = tx.objectStore('pendingActions');
        const record = await store.get(id);
        if (record) {
            record.syncStatus = 'syncing';
            record.syncAttempts = (record.syncAttempts || 0) + 1;
            record.lastSyncAt = Date.now();
            await store.put(record);
        }
        return tx.complete;
    }

    // Save local state (current session checkboxes)
    async saveLocalState(livestockId, isPresent) {
        const tx = this.db.transaction(['localState'], 'readwrite');
        const store = tx.objectStore('localState');
        
        await store.put({
            livestockId,
            isPresent,
            timestamp: Date.now()
        });
        return tx.complete;
    }

    // Get all local state
    async getAllLocalState() {
        const tx = this.db.transaction(['localState'], 'readonly');
        const store = tx.objectStore('localState');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const states = {};
                request.result.forEach(item => {
                    states[item.livestockId] = item.isPresent;
                });
                resolve(states);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Clear local state (after successful save)
    async clearLocalState() {
        const tx = this.db.transaction(['localState'], 'readwrite');
        const store = tx.objectStore('localState');
        await store.clear();
        return tx.complete;
    }

    // Get all attendance records for export
    async getAllAttendance() {
        const tx = this.db.transaction(['attendance'], 'readonly');
        const store = tx.objectStore('attendance');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveCache(key, value) {
        const tx = this.db.transaction(['cache'], 'readwrite');
        const store = tx.objectStore('cache');
        await store.put({
            key,
            value,
            updatedAt: Date.now()
        });
        return tx.complete;
    }

    async getCache(key) {
        const tx = this.db.transaction(['cache'], 'readonly');
        const store = tx.objectStore('cache');
        return await store.get(key);
    }

    async saveScanDraft(draft) {
        const tx = this.db.transaction(['scanDrafts'], 'readwrite');
        const store = tx.objectStore('scanDrafts');
        const record = {
            kind: 'photo_batch',
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ...draft
        };
        await store.add(record);
        return tx.complete;
    }

    async getPendingScanDrafts() {
        const tx = this.db.transaction(['scanDrafts'], 'readonly');
        const store = tx.objectStore('scanDrafts');
        const index = store.index('status');
        return new Promise((resolve, reject) => {
            const request = index.getAll('pending');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async markScanDraftProcessed(id) {
        const tx = this.db.transaction(['scanDrafts'], 'readwrite');
        const store = tx.objectStore('scanDrafts');
        const draft = await store.get(id);
        if (draft) {
            draft.status = 'processed';
            draft.updatedAt = Date.now();
            await store.put(draft);
        }
        return tx.complete;
    }
}

// Initialize database
const db = new LivestockDB();
db.init().then(() => {
    console.log('Database initialized');
}).catch(err => {
    console.error('Database initialization failed:', err);
});
