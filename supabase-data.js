// Farm data + owner layer (Supabase)
//
// Replaces the old Replit/Express server. Loads the herd (with lineage), checks
// the owner password, and does lineage edits + calf registration.
//
// Two levels of use:
//   - Daily app (workers): NO login. Just reads the herd and marks attendance.
//   - Owner screens (you): unlocked by a simple password, checked server-side by
//     the "farm-admin" Supabase function. The password is never in this file.
//
// Everything hangs off a single global: window.FarmData

(function () {
  const SUPABASE_URL = 'https://vousucfboetqtppjywlg.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mOLSxtGicEchOdWIdPL6BA_aaybClra'; // public key, safe in the browser
  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const ADMIN_FN = `${SUPABASE_URL}/functions/v1/farm-admin`;

  let _client = null;
  let _ownerPassword = null; // held in memory only; cleared on refresh or logout

  async function getClient() {
    if (_client) return _client;
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SUPABASE_CDN;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Could not load Supabase library'));
        document.head.appendChild(s);
      });
    }
    _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return _client;
  }

  function groupForId(id) {
    const s = String(id);
    if (s.startsWith('11')) return '11';
    if (s.startsWith('55')) return '55';
    if (s.startsWith('56')) return '56';
    if (s.startsWith('58')) return '58';
    if (s.startsWith('72')) return '72';
    if (/^[A-Za-z]/.test(s)) return 'special';
    return 'other';
  }

  function fromRow(r) {
    return {
      id: r.id,
      group: r.group_name || groupForId(r.id),
      is_inactive: r.is_inactive,
      status: r.status,
      statusDate: r.status_date,
      motherId: r.mother_id,
      fatherId: r.father_id,
      sex: r.sex,              // 'M' = Poo, 'F' = Tshegadi
      dateOfBirth: r.date_of_birth,
    };
  }

  // --- Herd (open read, no login needed) ---

  async function loadHerd() {
    const sb = await getClient();
    const { data, error } = await sb
      .from('farm_livestock')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return data.map(fromRow);
  }

  async function getStats() {
    const herd = await loadHerd();
    const byGroup = {};
    let active = 0;
    herd.forEach((a) => {
      byGroup[a.group] = (byGroup[a.group] || 0) + 1;
      if (!a.is_inactive) active += 1;
    });
    return { total: herd.length, active, inactive: herd.length - active, byGroup };
  }

  // --- Owner password gate (checked by the farm-admin function) ---

  async function callAdmin(action, payload) {
    const res = await fetch(ADMIN_FN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ password: _ownerPassword, action, payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, ...data };
  }

  // Type the password once to unlock the owner screens
  async function adminLogin(password) {
    _ownerPassword = password;
    const res = await callAdmin('login');
    if (!res.ok) _ownerPassword = null; // wrong password, stay locked
    return res;
  }

  function adminLogout() {
    _ownerPassword = null;
  }

  function isAdmin() {
    return _ownerPassword !== null;
  }

  // --- Owner actions (require the password) ---

  async function updateLineage(id, { motherId, fatherId, sex, dateOfBirth }) {
    if (!isAdmin()) return { ok: false, error: 'Locked' };
    return callAdmin('updateLineage', { id, motherId, fatherId, sex, dateOfBirth });
  }

  async function registerCalf({ id, motherId, fatherId, sex, dateOfBirth, group }) {
    if (!isAdmin()) return { ok: false, error: 'Locked' };
    return callAdmin('registerCalf', { id, motherId, fatherId, sex, dateOfBirth, group });
  }

  window.FarmData = {
    getClient,
    groupForId,
    loadHerd,
    getStats,
    adminLogin,
    adminLogout,
    isAdmin,
    updateLineage,
    registerCalf,
  };
})();
