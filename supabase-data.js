// Dikgomo farm data layer (Supabase)
//
// Public herd reads use the publishable key (RLS-protected).
// Owner actions (login, lineage, calves, comments, accounts) go through the
// farm-admin Edge Function, which checks the password server-side, issues a
// 3-day session token, and stamps every change with the logged-in name.

window.FarmData = (function () {
  const SUPABASE_URL = 'https://vousucfboetqtppjywlg.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_mOLSxtGicEchOdWIdPL6BA_aaybClra';
  const FN_URL = SUPABASE_URL + '/functions/v1/farm-admin';
  const FN_OCR_URL = SUPABASE_URL + '/functions/v1/farm-ocr';
  const FN_NOTIFY_URL = SUPABASE_URL + '/functions/v1/farm-notify';
  const FN_VOICE_URL = SUPABASE_URL + '/functions/v1/farm-voice';
  const SESSION_KEY = 'farm_session';

  // ---- lazy supabase-js client (for open herd reads only) ----
  let _client = null;
  async function getClient() {
    if (_client) return _client;
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Could not load Supabase library'));
        document.head.appendChild(s);
      });
    }
    _client = window.supabase.createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    return _client;
  }

  // ---- session helpers ----
  function getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!s || !s.token || !s.exp || s.exp <= Math.floor(Date.now() / 1000)) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }
  function isAdmin() { return !!getSession(); }
  function getUser() { const s = getSession(); return s ? { name: s.name, role: s.role } : null; }
  function isSuperSuper() { const s = getSession(); return !!s && s.role === 'supersuper'; }
  function adminLogout() { localStorage.removeItem(SESSION_KEY); }

  // ---- Edge Function calls ----
  async function callFn(action, params) {
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': PUBLISHABLE_KEY,
          'Authorization': 'Bearer ' + PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action, ...params }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.error) return { ok: false, error: 'HTTP ' + res.status };
      return data;
    } catch (e) {
      return { ok: false, error: 'No connection. (Ga go na inthanete.)' };
    }
  }

  async function callAuthed(action, params) {
    const s = getSession();
    if (!s) return { ok: false, error: 'Not logged in', code: 'AUTH' };
    const res = await callFn(action, { token: s.token, ...(params || {}) });
    if (res && res.code === 'AUTH') adminLogout(); // session died, force re-login
    return res;
  }

  async function adminLogin(password) {
    const res = await callFn('login', { password });
    if (res && res.ok && res.token) {
      const exp = Math.floor(Date.now() / 1000) + 3 * 86400;
      localStorage.setItem(SESSION_KEY, JSON.stringify({ token: res.token, name: res.name, role: res.role, exp }));
      return { ok: true, name: res.name, role: res.role };
    }
    return { ok: false, error: (res && res.error) || 'Login failed' };
  }

  // ---- herd (open read) ----
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
      sex: r.sex,
      dateOfBirth: r.date_of_birth,
      name: r.name,
      updatedBy: r.updated_by,
    };
  }
  async function loadHerd() {
    const sb = await getClient();
    const { data, error } = await sb.from('farm_livestock').select('*').order('id', { ascending: true });
    if (error) throw error;
    return data.map(fromRow);
  }
  async function getStats() {
    const herd = await loadHerd();
    let active = 0; const byGroup = {};
    herd.forEach((a) => { byGroup[a.group] = (byGroup[a.group] || 0) + 1; if (!a.is_inactive) active += 1; });
    return { total: herd.length, active, inactive: herd.length - active, byGroup };
  }

  // ---- owner actions (all attributed server-side to the logged-in name) ----
  function updateLineage(id, { motherId, fatherId, sex, dateOfBirth, comment } = {}) {
    return callAuthed('updateLineage', { id, motherId, fatherId, sex, dateOfBirth, comment });
  }
  function registerCalf({ id, motherId, fatherId, sex, dateOfBirth, group, comment } = {}) {
    return callAuthed('registerCalf', { id, motherId, fatherId, sex, dateOfBirth, group, comment });
  }
  function editAnimal({ id, newId, name, dateOfBirth, comment } = {}) {
    return callAuthed('editAnimal', { id, newId, name, dateOfBirth, comment });
  }
  function addComment({ livestockId, comment } = {}) {
    return callAuthed('addComment', { livestockId, comment });
  }
  function getComments(livestockId) {
    return callAuthed('getComments', { livestockId });
  }

  // ---- OCR: read tag numbers from a photo (farm-ocr function) ----
  async function scanVoice(audio, mediaType) {
    const sess = getSession();
    if (!sess) return { ok: false, error: 'Not logged in', code: 'AUTH' };
    try {
      const res = await fetch(FN_VOICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': PUBLISHABLE_KEY,
          'Authorization': 'Bearer ' + PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token: sess.token, audio: audio, mediaType: mediaType }),
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.code === 'AUTH') adminLogout();
      if (!res.ok && !data.error) return { ok: false, error: 'HTTP ' + res.status };
      return data;
    } catch (e) {
      return { ok: false, error: 'No connection. (Ga go na inthanete.)' };
    }
  }

  async function scanNumbers(image, mediaType) {
    const s = getSession();
    if (!s) return { ok: false, error: 'Not logged in', code: 'AUTH' };
    try {
      const res = await fetch(FN_OCR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': PUBLISHABLE_KEY,
          'Authorization': 'Bearer ' + PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token: s.token, image, mediaType }),
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.code === 'AUTH') adminLogout();
      if (!res.ok && !data.error) return { ok: false, error: 'HTTP ' + res.status };
      return data;
    } catch (e) {
      return { ok: false, error: 'No connection. (Ga go na inthanete.)' };
    }
  }

  // ---- account management (supersuper only; enforced server-side too) ----
  function listUsers() { return callAuthed('listUsers', {}); }
  function createUser({ name, password, role } = {}) { return callAuthed('createUser', { name, password, role }); }
  function deleteUser(name) { return callAuthed('deleteUser', { name }); }

  function logAudit(p) { return callFn('logAudit', p || {}); }
  function getAudit() { return callAuthed('getAudit', {}); }
  async function notifyAttendance(p) {
    try {
      const res = await fetch(FN_NOTIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': PUBLISHABLE_KEY, 'Authorization': 'Bearer ' + PUBLISHABLE_KEY },
        body: JSON.stringify(p || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.error) return { ok: false, error: 'HTTP ' + res.status };
      return data;
    } catch (e) {
      return { ok: false, error: 'No connection. (Ga go na inthanete.)' };
    }
  }

  // ---- shared daily register + health (open endpoints; shepherd has no login) ----
  function saveAttendanceCloud(date, presentIds, by, absentIds) { return callFn('saveAttendance', { date: date, presentIds: presentIds, by: by, absentIds: absentIds || [] }); }
  function getAttendanceCloud(date) { return callFn('getAttendance', date ? { date: date } : {}); }
  function setHealthCloud(livestockId, sick, dead, by) { return callFn('setHealth', { livestockId: livestockId, sick: sick, dead: dead, by: by }); }
  function getHealthCloud() { return callFn('getHealth', {}); }

  return {
    getClient, loadHerd, getStats, groupForId,
    adminLogin, adminLogout, isAdmin, getUser, isSuperSuper,
    updateLineage, registerCalf, editAnimal, addComment, getComments, scanNumbers, scanVoice,
    listUsers, createUser, deleteUser,
    logAudit, getAudit, notifyAttendance,
    saveAttendanceCloud, getAttendanceCloud, setHealthCloud, getHealthCloud,
  };
})();
