// IndexedDB Wrapper for Offline Storage
class LivestockDB {
    constructor() {
        this.dbName = 'LivestockAttendanceDB';
        this.version = 1;
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

                // Local livestock state (current session)
                if (!db.objectStoreNames.contains('localState')) {
                    db.createObjectStore('localState', { keyPath: 'livestockId' });
                }
            };
        });
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
            synced: false,
            date: new Date(timestamp).toISOString().split('T')[0]
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
            synced: false
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
}

// Initialize database
const db = new LivestockDB();
db.init().then(() => {
    console.log('Database initialized');
}).catch(err => {
    console.error('Database initialization failed:', err);
});
