// Owner panel (Setswana/English)
//
// Adds a small "Mong" (Owner) button. Tapping it asks for the owner password
// (checked by Supabase via FarmData). Once unlocked, the owner can edit an
// animal's lineage and register a new calf. Workers never need any of this.
//
// Requires supabase-data.js (window.FarmData) to be loaded first.

(function () {
  if (!window.FarmData) {
    console.warn('[owner-ui] FarmData not found. Load supabase-data.js before owner-ui.js');
    return;
  }

  let herd = [];      // cached herd for the pickers
  let herdById = {};

  // --- styling just for the floating button (everything else reuses app CSS) ---
  function injectStyle() {
    const css = `
      #ownerBtn{position:fixed;left:12px;bottom:16px;z-index:1500;
        background:var(--gray,#868e96);color:#fff;border:none;border-radius:24px;
        padding:10px 16px;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.25);
        cursor:pointer;display:flex;align-items:center;gap:6px}
      #ownerBtn:active{transform:scale(.97)}
      .owner-section{border-top:1px solid var(--light-gray,#e9ecef);margin-top:18px;padding-top:16px}
      .owner-section h3{color:var(--primary-green,#2c5f2d);margin-bottom:12px;font-size:17px}
      .owner-msg{margin-top:10px;padding:10px;border-radius:6px;font-size:14px;display:none}
      .owner-msg.ok{display:block;background:#e8f5e9;color:var(--dark-green,#1a3a1b)}
      .owner-msg.err{display:block;background:#ffe0e0;color:var(--red,#c92a2a)}
    `;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  // --- build the DOM (button + one modal that flips between gate and panel) ---
  function build() {
    const btn = document.createElement('button');
    btn.id = 'ownerBtn';
    btn.innerHTML = '<span>👤</span><span>Mong</span>';
    btn.onclick = open;
    document.body.appendChild(btn);

    const modal = document.createElement('div');
    modal.id = 'ownerModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close" id="ownerClose">&times;</span>

        <!-- password gate -->
        <div id="ownerGate">
          <h2>Mong (Owner)</h2>
          <p>Tsenya password go bula. (Enter the password to unlock.)</p>
          <input type="password" id="ownerPass" class="input-large" placeholder="Password" autocomplete="off">
          <div class="button-group">
            <button class="btn-secondary" id="ownerCancel">Tswala</button>
            <button class="btn-primary" id="ownerUnlock">Bula</button>
          </div>
          <div class="owner-msg" id="ownerGateMsg"></div>
        </div>

        <!-- owner panel -->
        <div id="ownerPanel" style="display:none">
          <span style="float:right">
            <button class="btn-secondary" id="ownerLock" style="padding:8px 12px;font-size:13px">🔒 Tswala</button>
          </span>
          <h2>Mong (Owner)</h2>

          <div class="owner-section">
            <h3>Tlhabolola Lotso (Edit lineage)</h3>
            <div class="form-group">
              <label for="linPick">Kgetha kgomo (Choose animal)</label>
              <input list="herdList" id="linPick" class="input-large" placeholder="Nomoro ya kgomo">
            </div>
            <div class="form-group">
              <label for="linMma">Mma (Mother)</label>
              <input list="herdList" id="linMma" class="input-large" placeholder="Nomoro ya ga mmagwe">
            </div>
            <div class="form-group">
              <label for="linRre">Rre (Father)</label>
              <input list="herdList" id="linRre" class="input-large" placeholder="Nomoro ya ga rragwe">
            </div>
            <div class="form-group">
              <label for="linSex">Bong (Sex)</label>
              <select id="linSex" class="input-large">
                <option value="">--</option>
                <option value="M">Poo (M)</option>
                <option value="F">Tshegadi (F)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="linDob">Letlha la matsalo (Date of birth)</label>
              <input type="date" id="linDob" class="input-large">
            </div>
            <button class="btn-primary" id="linSave" style="width:100%">Boloka Lotso</button>
            <div class="owner-msg" id="linMsg"></div>
          </div>

          <div class="owner-section">
            <h3>Kwadisa Namane e Ntšhwa (Register new calf)</h3>
            <div class="form-group">
              <label for="calfId">Nomoro (Tag number)</label>
              <input type="text" id="calfId" class="input-large" placeholder="P.f. 11272">
            </div>
            <div class="form-group">
              <label for="calfMma">Mma (Mother)</label>
              <input list="herdList" id="calfMma" class="input-large" placeholder="Nomoro ya ga mmagwe">
            </div>
            <div class="form-group">
              <label for="calfRre">Rre (Father)</label>
              <input list="herdList" id="calfRre" class="input-large" placeholder="Nomoro ya ga rragwe">
            </div>
            <div class="form-group">
              <label for="calfSex">Bong (Sex)</label>
              <select id="calfSex" class="input-large">
                <option value="">--</option>
                <option value="M">Poo (M)</option>
                <option value="F">Tshegadi (F)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="calfDob">Letlha la matsalo (Date of birth)</label>
              <input type="date" id="calfDob" class="input-large">
            </div>
            <button class="btn-primary" id="calfSave" style="width:100%">Kwadisa Namane</button>
            <div class="owner-msg" id="calfMsg"></div>
          </div>
        </div>

        <datalist id="herdList"></datalist>
      </div>`;
    document.body.appendChild(modal);

    // wire events
    document.getElementById('ownerClose').onclick = close;
    document.getElementById('ownerCancel').onclick = close;
    document.getElementById('ownerUnlock').onclick = unlock;
    document.getElementById('ownerPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });
    document.getElementById('ownerLock').onclick = lock;
    document.getElementById('linPick').addEventListener('change', fillLineage);
    document.getElementById('linSave').onclick = saveLineage;
    document.getElementById('calfSave').onclick = saveCalf;
  }

  function msg(id, text, ok) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'owner-msg ' + (ok ? 'ok' : 'err');
  }
  function clearMsg(id) {
    const el = document.getElementById(id);
    el.textContent = '';
    el.className = 'owner-msg';
  }

  function open() {
    document.getElementById('ownerModal').classList.remove('hidden');
    if (window.FarmData.isAdmin()) showPanel(); else showGate();
  }
  function close() {
    document.getElementById('ownerModal').classList.add('hidden');
  }
  function showGate() {
    document.getElementById('ownerGate').style.display = '';
    document.getElementById('ownerPanel').style.display = 'none';
    document.getElementById('ownerPass').value = '';
    clearMsg('ownerGateMsg');
  }
  function showPanel() {
    document.getElementById('ownerGate').style.display = 'none';
    document.getElementById('ownerPanel').style.display = '';
    loadHerd();
  }

  async function unlock() {
    const pass = document.getElementById('ownerPass').value;
    if (!pass) return;
    msg('ownerGateMsg', 'Go a sekasekwa...', true);
    const res = await window.FarmData.adminLogin(pass);
    if (res.ok) { showPanel(); }
    else { msg('ownerGateMsg', 'Password e fosagetse. (Wrong password.)', false); }
  }

  function lock() {
    window.FarmData.adminLogout();
    showGate();
  }

  async function loadHerd() {
    try {
      herd = await window.FarmData.loadHerd();
      herdById = {};
      const dl = document.getElementById('herdList');
      dl.innerHTML = herd.map((a) => `<option value="${a.id}">`).join('');
      herd.forEach((a) => { herdById[a.id] = a; });
    } catch (e) {
      msg('linMsg', 'Ga go kgonege go laisa dikgomo. Netefatsa inthanete. (Could not load. Check connection.)', false);
    }
  }

  function fillLineage() {
    const id = document.getElementById('linPick').value.trim();
    const a = herdById[id];
    clearMsg('linMsg');
    document.getElementById('linMma').value = a && a.motherId ? a.motherId : '';
    document.getElementById('linRre').value = a && a.fatherId ? a.fatherId : '';
    document.getElementById('linSex').value = a && a.sex ? a.sex : '';
    document.getElementById('linDob').value = a && a.dateOfBirth ? a.dateOfBirth : '';
  }

  async function saveLineage() {
    const id = document.getElementById('linPick').value.trim();
    if (!id) { msg('linMsg', 'Kgetha kgomo pele. (Choose an animal first.)', false); return; }
    if (!herdById[id]) { msg('linMsg', 'Kgomo ga e teng. (No such animal.)', false); return; }
    const btn = document.getElementById('linSave');
    btn.disabled = true; btn.textContent = 'Go boloka...';
    const res = await window.FarmData.updateLineage(id, {
      motherId: document.getElementById('linMma').value.trim(),
      fatherId: document.getElementById('linRre').value.trim(),
      sex: document.getElementById('linSex').value,
      dateOfBirth: document.getElementById('linDob').value || null,
    });
    btn.disabled = false; btn.textContent = 'Boloka Lotso';
    if (res.ok) { msg('linMsg', 'Bolokilwe! ✓ (Saved.)', true); await loadHerd(); }
    else { msg('linMsg', 'Phoso: ' + (res.error || ''), false); }
  }

  async function saveCalf() {
    const id = document.getElementById('calfId').value.trim();
    if (!id) { msg('calfMsg', 'Tsenya nomoro. (Enter a tag number.)', false); return; }
    const btn = document.getElementById('calfSave');
    btn.disabled = true; btn.textContent = 'Go kwadisa...';
    const res = await window.FarmData.registerCalf({
      id,
      motherId: document.getElementById('calfMma').value.trim(),
      fatherId: document.getElementById('calfRre').value.trim(),
      sex: document.getElementById('calfSex').value,
      dateOfBirth: document.getElementById('calfDob').value || null,
    });
    btn.disabled = false; btn.textContent = 'Kwadisa Namane';
    if (res.ok) {
      msg('calfMsg', 'Namane e kwadisitswe! ✓ (Calf registered.)', true);
      ['calfId', 'calfMma', 'calfRre', 'calfDob'].forEach((i) => { document.getElementById(i).value = ''; });
      document.getElementById('calfSex').value = '';
      await loadHerd();
    } else {
      msg('calfMsg', 'Phoso: ' + (res.error || ''), false);
    }
  }

  function init() { injectStyle(); build(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
