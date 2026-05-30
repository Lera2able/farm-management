// Sync Logic — Supabase backend
//
// The app stays offline-first: every action is saved locally in IndexedDB (db.js)
// and pushed up to Supabase when there is a connection. This file only handles the
// "push to the cloud" part, so the rest of the app is unchanged.

const SUPABASE_URL = 'https://vousucfboetqtppjywlg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mOLSxtGicEchOdWIdPL6BA_aaybClra'; // public key, safe for the browser
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

let _sbClient = null;

// Load the Supabase library on demand and create a client.
// Doing it here means index.html needs no extra <script> tag.
async function getSupabase() {
    if (_sbClient) return _sbClient;
    if (!window.supabase) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = SUPABASE_CDN;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Could not load Supabase library'));
            document.head.appendChild(s);
        });
    }
    _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return _sbClient;
}

// Auto-sync: push anything that hasn't been synced yet
async function autoSync() {
    const syncBtn = document.getElementById('syncBtn');
    const syncIcon = document.getElementById('syncIcon');
    const syncText = document.getElementById('syncText');

    try {
        if (syncBtn) { syncBtn.classList.add('syncing'); syncBtn.disabled = true; }
        if (syncIcon) syncIcon.textContent = '⏳';
        if (syncText) syncText.textContent = 'Tlhabolola...';

        const unsyncedAttendance = await db.getUnsyncedAttendance();
        const unsyncedActions = await db.getUnsyncedActions();

        if (unsyncedAttendance.length === 0 && unsyncedActions.length === 0) {
            showSyncStatus('Ga go na se se sa ntšhweng', 'online');
            return;
        }

        // Make sure we can reach Supabase before marking anything as synced
        await getSupabase();

        for (const record of unsyncedAttendance) {
            await syncAttendanceRecord(record);
            await db.markAttendanceSynced(record.id);
        }

        for (const action of unsyncedActions) {
            await syncAction(action);
            await db.markActionSynced(action.id);
        }

        const count = unsyncedAttendance.length + unsyncedActions.length;
        showSyncStatus(`Tlhabololo e atlehile! ${count} rekoto`, 'online');

    } catch (error) {
        console.error('Sync error:', error);
        showSyncStatus('Phoso ya tlhabololo! Leka gape', 'error');
    } finally {
        if (syncBtn) { syncBtn.classList.remove('syncing'); syncBtn.disabled = false; }
        if (syncIcon) syncIcon.textContent = '🔄';
        if (syncText) syncText.textContent = 'Tlhabolola';
    }
}

// Push a single attendance record to farm_attendance
async function syncAttendanceRecord(record) {
    const sb = await getSupabase();
    const totalActive = LIVESTOCK_DATA.filter(l => !l.is_inactive).length;

    const { error } = await sb
        .from('farm_attendance')
        .upsert({
            shepherd_name: record.shepherdName,
            date: record.date,
            recorded_at: new Date(record.timestamp).toISOString(),
            present_livestock: record.presentLivestock,
            present_count: record.presentLivestock.length,
            total_active: totalActive,
            client_timestamp: record.timestamp
        }, { onConflict: 'client_timestamp', ignoreDuplicates: true });

    if (error) throw error;
    return true;
}

// Push a single action (add / sold / died) to farm_events and update the herd
async function syncAction(action) {
    const sb = await getSupabase();
    const d = action.data || {};

    // 1. log the event (append-only history)
    const { error: evErr } = await sb
        .from('farm_events')
        .upsert({
            event_type: action.type,
            livestock_id: d.livestockId,
            event_date: d.date || null,
            submitted_by: d.submittedBy || null,
            client_timestamp: action.timestamp
        }, { onConflict: 'client_timestamp', ignoreDuplicates: true });
    if (evErr) throw evErr;

    // 2. reflect the change on the herd table
    if (action.type === 'add_livestock') {
        const { error } = await sb
            .from('farm_livestock')
            .upsert({
                id: d.livestockId,
                group_name: groupForId(d.livestockId),
                is_inactive: false,
                status: 'active',
                added_by: d.submittedBy || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw error;
    } else if (action.type === 'sold' || action.type === 'died') {
        const { error } = await sb
            .from('farm_livestock')
            .update({
                is_inactive: true,
                status: action.type,
                status_date: d.date || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', d.livestockId);
        if (error) throw error;
    }

    return true;
}

// Work out the group from a tag number (matches the groups in livestock-data.js)
function groupForId(id) {
    const s = String(id);
    if (s.startsWith('11')) return '11';
    if (s.startsWith('55')) return '55';
    if (s.startsWith('56')) return '56';
    if (s.startsWith('58')) return '58';
    if (s.startsWith('72')) return '72';
    return 'other';
}

// Pull every attendance record from the cloud (handy for an admin / multi-device view)
async function fetchCloudAttendance() {
    const sb = await getSupabase();
    const { data, error } = await sb
        .from('farm_attendance')
        .select('*')
        .order('recorded_at', { ascending: false });
    if (error) throw error;
    return data;
}

// --- Local export (reads IndexedDB on this device) ---

async function exportAttendanceData() {
    const allRecords = await db.getAllAttendance();

    const csvRows = [
        ['Date', 'Shepherd', 'Total Active', 'Present Count', 'Absent Count', 'Synced'].join(',')
    ];

    allRecords.forEach(record => {
        const totalActive = LIVESTOCK_DATA.filter(l => !l.is_inactive).length;
        const presentCount = record.presentLivestock.length;
        const absentCount = totalActive - presentCount;

        csvRows.push([
            record.date,
            record.shepherdName,
            totalActive,
            presentCount,
            absentCount,
            record.synced ? 'Yes' : 'No'
        ].join(','));
    });

    return csvRows.join('\n');
}

async function downloadAttendanceCSV() {
    const csv = await exportAttendanceData();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `livestock-attendance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
