// Owner panel (Setswana/English) — self-contained styling
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

  let herd = [];
  let herdById = {};

  function injectStyle() {
    const css = `
      #ownerBtn{position:fixed;left:12px;bottom:16px;z-index:1500;background:#6b7280;color:#fff;
        border:none;border-radius:24px;padding:10px 16px;font-size:14px;font-weight:600;
        box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;display:flex;align-items:center;gap:6px;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
      #ownerBtn:active{transform:scale(.97)}
      .ow-overlay{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.6);display:flex;
        align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
      .ow-overlay.ow-hidden{display:none}
      .ow-card{background:#fff;border-radius:12px;max-width:460px;width:100%;padding:24px;
        box-shadow:0 10px 40px rgba(0,0,0,.3);margin:auto;color:#1f2937}
      .ow-card h2{font-size:20px;margin:0 0 6px;color:#1f2937}
      .ow-card p{color:#6b7280;font-size:14px;margin:0 0 14px}
      .ow-x{float:right;font-size:28px;line-height:1;color:#9ca3af;cursor:pointer;font-weight:700}
      .ow-x:active{color:#1f2937}
      .ow-section{border-top:1px solid #e5e7eb;margin-top:20px;padding-top:16px}
      .ow-section h3{color:#059669;font-size:16px;margin:0 0 12px}
      .ow-field{margin-bottom:12px}
      .ow-field label{display:block;font-weight:600;font-size:14px;margin-bottom:5px;color:#374151}
      .ow-input{width:100%;padding:12px;font-size:16px;border:1px solid #d1d5db;border-radius:8px;
        outline:none;background:#fff;color:#1f2937}
      .ow-input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
      .ow-btn{width:100%;padding:13px;font-size:16px;font-weight:600;border:none;border-radius:8px;
        cursor:pointer;background:#3b82f6;color:#fff}
      .ow-btn:active{background:#2563eb}
      .ow-btn[disabled]{opacity:.6}
      .ow-btn-grey{background:#6b7280;padding:8px 12px;font-size:13px;width:auto}
      .ow-btn-grey:active{background:#4b5563}
      .ow-row{display:flex;gap:10px}
      .ow-row .ow-btn{flex:1}
      .ow-msg{margin-top:10px;padding:10px;border-radius:8px;font-size:14px;display:none}
      .ow-msg.ok{display:block;background:#d1fae5;color:#065f46}
      .ow-msg.err{display:block;background:#fee2e2;color:#b91c1c}
    `;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  function build() {
    const btn = document.createElement('button');
    btn.id = 'ownerBtn';
    btn.innerHTML = '<span>👤</span><span>Mong</span>';
    btn.onclick = open;
    document.body.appendChild(btn);

    const modal = document.createElement('div');
    modal.id = 'ownerModal';
    modal.className = 'ow-overlay ow-hidden';
    modal.innerHTML = `
      <div class="ow-card">
        <span class="ow-x" id="owClose">&times;</span>

        <div id="owGate">
          <h2>Mong (Owner)</h2>
          <p>Tsenya password go bula. (Enter the password to unlock.)</p>
          <div class="ow-field">
            <input type="password" id="owPass" class="ow-input" placeholder="Password" autocomplete="off">
          </div>
          <div class="ow-row">
            <button class="ow-btn ow-btn-grey" id="owCancel" style="width:auto;flex:1">Tswala</button>
            <button class="ow-btn" id="owUnlock">Bula</button>
          </div>
          <div class="ow-msg" id="owGateMsg"></div>
        </div>

        <div id="owPanel" style="display:none">
          <span style="float:right"><button class="ow-btn ow-btn-grey" id="owLock">🔒 Tswala</button></span>
          <h2>Mong (Owner)</h2>

          <div class="ow-section">
            <h3>Tlhabolola Lotso (Edit lineage)</h3>
            <div class="ow-field">
              <label for="linPick">Kgetha kgomo (Choose animal)</label>
              <input list="owHerd" id="linPick" class="ow-input" placeholder="Nomoro ya kgomo">
            </div>
            <div class="ow-field">
              <label for="linMma">Mma (Mother)</label>
              <input list="owHerd" id="linMma" class="ow-input" placeholder="Nomoro ya ga mmagwe">
            </div>
            <div class="ow-field">
              <label for="linRre">Rre (Father)</label>
              <input list="owHerd" id="linRre" class="ow-input" placeholder="Nomoro ya ga rragwe">
            </div>
            <div class="ow-field">
              <label for="linSex">Bong (Sex)</label>
              <select id="linSex" class="ow-input">
                <option value="">--</option>
                <option value="M">Poo (M)</option>
                <option value="F">Tshegadi (F)</option>
              </select>
            </div>
            <div class="ow-field">
              <label for="linDob">Letlha la matsalo (Date of birth)</label>
              <input type="date" id="linDob" class="ow-input">
            </div>
            <button class="ow-btn" id="linSave">Boloka Lotso</button>
            <div class="ow-msg" id="linMsg"></div>
          </div>

          <div class="ow-section">
            <h3>Kwadisa Namane e Ntšhwa (Register new calf)</h3>
            <div class="ow-field">
              <label for="calfId">Nomoro (Tag number)</label>
              <input type="text" id="calfId" class="ow-input" placeholder="P.f. 11272">
            </div>
            <div class="ow-field">
              <label for="calfMma">Mma (Mother)</label>
              <input list="owHerd" id="calfMma" class="ow-input" placeholder="Nomoro ya ga mmagwe">
            </div>
            <div class="ow-field">
              <label for="calfRre">Rre (Father)</label>
              <input list="owHerd" id="calfRre" class="ow-input" placeholder="Nomoro ya ga rragwe">
            </div>
            <div class="ow-field">
              <label for="calfSex">Bong (Sex)</label>
              <select id="calfSex" class="ow-input">
                <option value="">--</option>
                <option value="M">Poo (M)</option>
                <option value="F">Tshegadi (F)</option>
              </select>
            </div>
            <div class="ow-field">
              <label for="calfDob">Letlha la matsalo (Date of birth)</label>
              <input type="date" id="calfDob" class="ow-input">
            </div>
            <button class="ow-btn" id="calfSave">Kwadisa Namane</button>
            <div class="ow-msg" id="calfMsg"></div>
          </div>
        </div>

        <datalist id="owHerd"></datalist>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('owClose').onclick = close;
    document.getElementById('owCancel').onclick = close;
    document.getElementById('owUnlock').onclick = unlock;
    document.getElementById('owPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });
    document.getElementById('owLock').onclick = lock;
    document.getElementById('linPick').addEventListener('change', fillLineage);
    document.getElementById('linSave').onclick = saveLineage;
    document.getElementById('calfSave').onclick = saveCalf;
  }

  function msg(id, text, ok) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'ow-msg ' + (ok ? 'ok' : 'err');
  }
  function clearMsg(id) {
    const el = document.getElementById(id);
    el.textContent = '';
    el.className = 'ow-msg';
  }

  function open() {
    document.getElementById('ownerModal').classList.remove('ow-hidden');
    if (window.FarmData.isAdmin()) showPanel(); else showGate();
  }
  function close() {
    document.getElementById('ownerModal').classList.add('ow-hidden');
  }
  function showGate() {
    document.getElementById('owGate').style.display = '';
    document.getElementById('owPanel').style.display = 'none';
    document.getElementById('owPass').value = '';
    clearMsg('owGateMsg');
  }
  function showPanel() {
    document.getElementById('owGate').style.display = 'none';
    document.getElementById('owPanel').style.display = '';
    loadHerd();
  }

  async function unlock() {
    const pass = document.getElementById('owPass').value;
    if (!pass) return;
    msg('owGateMsg', 'Go a sekasekwa...', true);
    const res = await window.FarmData.adminLogin(pass);
    if (res.ok) showPanel();
    else msg('owGateMsg', 'Password e fosagetse. (Wrong password.)', false);
  }

  function lock() {
    window.FarmData.adminLogout();
    showGate();
  }

  async function loadHerd() {
    try {
      herd = await window.FarmData.loadHerd();
      herdById = {};
      document.getElementById('owHerd').innerHTML = herd.map((a) => `<option value="${a.id}">`).join('');
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
    else msg('linMsg', 'Phoso: ' + (res.error || ''), false);
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
