// Farm data + admin layer (Supabase)
//
// This replaces the job the old Replit/Express server used to do. It loads the
// herd (with lineage), handles the owner login, and lets the owner edit lineage
// and register calves. Daily attendance still goes through sync.js as before.
//
// Everything hangs off a single global: window.FarmData

(function () {
  const SUPABASE_URL = 'https://vousucfboetqtppjywlg.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mOLSxtGicEchOdWIdPL6BA_aaybClra'; // public key, safe in the browser
  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  let _client = null;

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

  // Work out the group from a tag number (same rule the app already uses)
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

  // Turn a database row into the shape the app uses (camelCase)
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

  // --- Herd ---

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

  // --- Admin login (Supabase Auth) ---
  // Create one owner account in Supabase: Authentication > Users > Add user.

  async function adminLogin(email, password) {
    const sb = await getClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function adminLogout() {
    const sb = await getClient();
    await sb.auth.signOut();
  }

  async function isAdmin() {
    const sb = await getClient();
    const { data } = await sb.auth.getSession();
    return !!(data && data.session);
  }

  // --- Owner actions ---

  // Set or change an animal's parents, sex and date of birth
  async function updateLineage(id, { motherId, fatherId, sex, dateOfBirth }) {
    const sb = await getClient();
    const { error } = await sb
      .from('farm_livestock')
      .update({
        mother_id: motherId || null,
        father_id: fatherId || null,
        sex: sex || null,
        date_of_birth: dateOfBirth || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  // Register a new calf, with optional lineage
  async function registerCalf({ id, motherId, fatherId, sex, dateOfBirth, group }) {
    const sb = await getClient();
    const { data, error } = await sb
      .from('farm_livestock')
      .insert({
        id: String(id).trim(),
        group_name: group || groupForId(id),
        is_inactive: false,
        status: 'active',
        mother_id: motherId || null,
        father_id: fatherId || null,
        sex: sex || null,
        date_of_birth: dateOfBirth || null,
      })
      .select()
      .single();
    if (error) {
      // 23505 = duplicate primary key (tag already exists)
      if (error.code === '23505') return { ok: false, error: 'Nomoro e e teng' };
      return { ok: false, error: error.message };
    }
    return { ok: true, animal: fromRow(data) };
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
