// Owner panel (Setswana/English) — self-contained styling
//
// Floating "Mong" button. Logged-out farmers only ever see tick + save on the
// main screen. Owners log in (3-day session) and get lineage editing, calf
// registration and comments. The supersuper also gets account management.
//
// Requires supabase-data.js (window.FarmData) loaded first.

(function () {
  if (!window.FarmData) {
    console.warn('[owner-ui] FarmData not found. Load supabase-data.js before owner-ui.js');
    return;
  }

  const F = window.FarmData;
  let herd = [];
  let herdById = {};
  let animEditingId = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function injectStyle() {
    const css = `
      #ownerBtn{position:fixed;left:12px;bottom:16px;z-index:1500;background:#6b7280;color:#fff;
        border:none;border-radius:24px;padding:10px 16px;font-size:14px;font-weight:600;
        box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;display:flex;align-items:center;gap:6px;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:60vw}
      #ownerBtn span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #ownerBtn:active{transform:scale(.97)}
      .ow-overlay{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.6);display:flex;
        align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
      .ow-overlay.ow-hidden{display:none}
      .ow-card{background:#fff;border-radius:16px;max-width:900px;width:100%;padding:24px;
        box-shadow:0 10px 40px rgba(0,0,0,.3);margin:auto;color:#1f2937}
      .ow-card h2{font-size:20px;margin:0 0 6px;color:#1f2937}
      .ow-card p{color:#6b7280;font-size:14px;margin:0 0 14px}
      .ow-x{float:right;font-size:28px;line-height:1;color:#9ca3af;cursor:pointer;font-weight:700}
      .ow-x:active{color:#1f2937}
      .ow-panel-shell{display:flex;flex-direction:column;gap:16px}
      .ow-banner{background:linear-gradient(135deg,#ecfdf5,#eff6ff);border:1px solid #d1fae5;border-radius:14px;padding:16px 18px}
      .ow-banner h2{margin:0 0 4px}
      .ow-section{border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#fff;margin:0}
      .ow-grid{display:grid;gap:16px}
      .ow-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
      .ow-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
      .ow-section h3{color:#059669;font-size:16px;margin:0 0 6px}
      .ow-section p{margin:0 0 12px}
      .ow-field{margin-bottom:12px}
      .ow-field label{display:block;font-weight:600;font-size:14px;margin-bottom:5px;color:#374151}
      .ow-input{width:100%;padding:12px;font-size:16px;border:1px solid #d1d5db;border-radius:8px;
        outline:none;background:#fff;color:#1f2937;font-family:inherit}
      .ow-input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
      textarea.ow-input{resize:vertical}
      .ow-btn{width:100%;padding:13px;font-size:16px;font-weight:600;border:none;border-radius:8px;
        cursor:pointer;background:#3b82f6;color:#fff;margin-top:4px}
      .ow-btn:active{background:#2563eb}
      .ow-btn[disabled]{opacity:.6}
      .ow-btn-grey{background:#6b7280}
      .ow-btn-grey:active{background:#4b5563}
      .ow-row{display:flex;gap:10px}
      .ow-row .ow-btn{flex:1}
      .ow-meta{font-size:12px;color:#6b7280;margin:-4px 0 12px}
      .ow-msg{margin-top:10px;padding:10px;border-radius:8px;font-size:14px;display:none}
      .ow-msg.ok{display:block;background:#d1fae5;color:#065f46}
      .ow-msg.err{display:block;background:#fee2e2;color:#b91c1c}
      .ow-comments{margin-top:12px;display:flex;flex-direction:column;gap:8px}
      .ow-comment{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:14px}
      .ow-comment .ow-cmeta{font-size:11px;color:#6b7280;margin-top:4px}
      .ow-list{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
      .ow-uitem{display:flex;align-items:center;justify-content:space-between;background:#f9fafb;
        border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px}
      .ow-uitem .ow-uname{font-weight:600}
      .ow-pill{font-size:11px;padding:2px 8px;border-radius:10px;background:#e5e7eb;color:#374151;margin-left:8px}
      .ow-pill.super2{background:#fde68a;color:#92400e}
      .ow-del{background:#ef4444;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer}
      .ow-inline-help{font-size:12px;color:#6b7280;margin-top:-4px;margin-bottom:10px}
      @media (max-width:700px){.ow-grid-2,.ow-grid-3{grid-template-columns:1fr}.ow-card{padding:18px}}
      #ocrBtn{position:fixed;left:12px;bottom:60px;z-index:1500;background:#3b82f6;color:#fff;border:none;border-radius:24px;padding:10px 16px;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;align-items:center;gap:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
      #ocrBtn:active{transform:scale(.97)}
      .ocr-st{font-weight:700;padding:0 6px;white-space:nowrap}
      .ocr-st.st-ok{color:#059669}.ocr-st.st-unknown{color:#d97706}.ocr-st.st-inactive{color:#ef4444}
      .ocr-val{max-width:150px}
      .ocr-kind{max-width:110px;padding:8px;font-size:14px}
      .ocr-edit{background:#f59e0b;color:#111827;border:none;border-radius:8px;padding:8px 10px;font-size:13px;font-weight:700;cursor:pointer}
    `;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  function build() {
    const btn = document.createElement('button');
    btn.id = 'ownerBtn';
    btn.innerHTML = '<span>👤</span><span id="ownerBtnLabel">Mong</span>';
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
          <p>Tsenya password go bula. (Enter your password to unlock.)</p>
          <div class="ow-field"><input type="password" id="owPass" class="ow-input" placeholder="Password" autocomplete="off"></div>
          <div class="ow-row">
            <button class="ow-btn ow-btn-grey" id="owCancel">Tswala</button>
            <button class="ow-btn" id="owUnlock">Bula</button>
          </div>
          <div class="ow-msg" id="owGateMsg"></div>
        </div>

        <div id="owPanel" style="display:none">
          <span style="float:right"><button class="ow-btn ow-btn-grey" id="owLock" style="width:auto">🔒 Tswala</button></span>
          <div class="ow-panel-shell">
            <div class="ow-banner">
              <h2 id="owHello">Mong</h2>
              <p>Laola lotso, ngwadisa diphetogo, le tlhokomela akhaonto tsotlhe mo lefelong le le lengwe. Manage lineage, animal records, and accounts from one place.</p>
            </div>

            <div class="ow-grid ow-grid-2">
              <div class="ow-section">
                <h3>Tlhabolola Lotso (Edit lineage)</h3>
                <p>Kgetha nomoro, mme o tsenye mma le rre mo mabokosong a a gaufi le yone.</p>
                <div class="ow-grid ow-grid-3">
                  <div class="ow-field">
                    <label for="linPick">Nomoro (Animal number)</label>
                    <input list="owHerd" id="linPick" class="ow-input" placeholder="Nomoro ya kgomo">
                  </div>
                  <div class="ow-field"><label for="linMma">Mma (Mother)</label><input list="owHerd" id="linMma" class="ow-input" placeholder="Nomoro ya ga mmagwe"></div>
                  <div class="ow-field"><label for="linRre">Rre (Father)</label><input list="owHerd" id="linRre" class="ow-input" placeholder="Nomoro ya ga rragwe"></div>
                </div>
                <div id="linMeta" class="ow-meta"></div>
                <div class="ow-grid ow-grid-2">
                  <div class="ow-field"><label for="linSex">Bong (Sex)</label>
                    <select id="linSex" class="ow-input"><option value="">--</option><option value="M">Poo (M)</option><option value="F">Tshegadi (F)</option></select>
                  </div>
                  <div class="ow-field"><label for="linDob">Letlha la matsalo (Date of birth)</label><input type="date" id="linDob" class="ow-input"></div>
                </div>
                <button class="ow-btn" id="linSave">Boloka Lotso</button>
                <div class="ow-msg" id="linMsg"></div>

                <div class="ow-field" style="margin-top:16px">
                  <label for="cmtBox">Dikakanyo (Comment / note)</label>
                  <textarea id="cmtBox" class="ow-input" rows="2" placeholder="Kwala kakanyo ka kgomo e..."></textarea>
                </div>
                <button class="ow-btn ow-btn-grey" id="cmtAdd">Engadisa Kakanyo (Add comment)</button>
                <div class="ow-msg" id="cmtMsg"></div>
                <div id="cmtList" class="ow-comments"></div>
              </div>

              <div class="ow-section">
                <h3>Kwadisa Namane e Ntšhwa (Register new calf)</h3>
                <p>Tsenya nomoro ya namane, mme o kwale mma le rre mo mabokosong a a gaufi.</p>
                <div class="ow-grid ow-grid-3">
                  <div class="ow-field"><label for="calfId">Nomoro (Tag number)</label><input type="text" id="calfId" class="ow-input" placeholder="P.f. 11272"></div>
                  <div class="ow-field"><label for="calfMma">Mma (Mother)</label><input list="owHerd" id="calfMma" class="ow-input" placeholder="Nomoro ya ga mmagwe"></div>
                  <div class="ow-field"><label for="calfRre">Rre (Father)</label><input list="owHerd" id="calfRre" class="ow-input" placeholder="Nomoro ya ga rragwe"></div>
                </div>
                <div class="ow-grid ow-grid-2">
                  <div class="ow-field"><label for="calfSex">Bong (Sex)</label>
                    <select id="calfSex" class="ow-input"><option value="">--</option><option value="M">Poo (M)</option><option value="F">Tshegadi (F)</option></select>
                  </div>
                  <div class="ow-field"><label for="calfDob">Letlha la matsalo (Date of birth)</label><input type="date" id="calfDob" class="ow-input"></div>
                </div>
                <button class="ow-btn" id="calfSave">Kwadisa Namane</button>
                <div class="ow-msg" id="calfMsg"></div>
              </div>
            </div>

            <div class="ow-section">
              <div style="display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap">
                <div>
                  <h3>Recently Added</h3>
                  <p>Ditsenyo tse di sa tswang go tsenngwa mo registry, segolo thata tse di tswang mo ditshwantshong. Recently added records, especially from photo imports.</p>
                </div>
                <button class="ow-btn ow-btn-grey" id="newAddRefresh" style="width:auto;margin-top:0">Tsosolosa (Refresh)</button>
              </div>
              <div class="ow-msg" id="newAddMsg"></div>
              <div id="newAddList" class="ow-comments"></div>
            </div>

            <div class="ow-section" id="owAccounts" style="display:none">
              <h3>Di-akhaonto (Accounts)</h3>
              <p>Tlhama kgotsa tlosa batho ba ba ka tsenang mo admin.</p>
              <div id="owUserList" class="ow-list"></div>
              <div class="ow-grid ow-grid-3">
                <div class="ow-field"><label for="auName">Leina (Name)</label><input id="auName" class="ow-input" placeholder="P.f. Thabo"></div>
                <div class="ow-field"><label for="auPass">Password</label><input id="auPass" class="ow-input" type="text" placeholder="Password e ntšhwa"></div>
                <div class="ow-field"><label for="auRole">Karolo (Role)</label>
                  <select id="auRole" class="ow-input"><option value="super">Super (edit only)</option><option value="supersuper">Supersuper (manage accounts)</option></select>
                </div>
              </div>
              <button class="ow-btn" id="auCreate">Tlhama akhaonto (Create account)</button>
              <div class="ow-msg" id="auMsg"></div>
            </div>
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
    document.getElementById('linPick').addEventListener('change', onPickAnimal);
    document.getElementById('linSave').onclick = saveLineage;
    document.getElementById('cmtAdd').onclick = addComment;
    document.getElementById('calfSave').onclick = saveCalf;
    document.getElementById('auCreate').onclick = createUser;
    document.getElementById('newAddRefresh').onclick = loadNewlyAdded;

    buildScan();
    buildAnimEditor();
    buildSickDeadEditor();
    buildAuditModal();
    refreshButton();
  }

  function refreshButton() {
    const u = F.getUser();
    document.getElementById('ownerBtnLabel').textContent = u ? u.name : 'Mong';
    const ob = document.getElementById('ocrBtn');
    if (ob) ob.style.display = F.isAdmin() ? 'flex' : 'none';
  }

  function msg(id, text, ok) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'ow-msg ' + (ok ? 'ok' : 'err');
  }
  function clearMsg(id) { const el = document.getElementById(id); el.textContent = ''; el.className = 'ow-msg'; }

  // if a call comes back with an expired session, drop to the login screen
  function authFailed(res) {
    if (res && res.code === 'AUTH') { refreshButton(); showGate(); msg('owGateMsg', 'Nako e fedile, tsena gape. (Session ended, log in again.)', false); return true; }
    return false;
  }

  function open() {
    document.getElementById('ownerModal').classList.remove('ow-hidden');
    if (F.isAdmin()) showPanel(); else showGate();
  }
  function close() { document.getElementById('ownerModal').classList.add('ow-hidden'); }

  function showGate() {
    document.getElementById('owGate').style.display = '';
    document.getElementById('owPanel').style.display = 'none';
    document.getElementById('owPass').value = '';
    clearMsg('owGateMsg');
  }
  function showPanel() {
    document.getElementById('owGate').style.display = 'none';
    document.getElementById('owPanel').style.display = '';
    const u = F.getUser();
    document.getElementById('owHello').textContent = u ? ('Dumela, ' + u.name) : 'Mong';
    document.getElementById('owAccounts').style.display = F.isSuperSuper() ? '' : 'none';
    refreshButton();
    if (typeof window.loadGroup === 'function') window.loadGroup();
    if (typeof window.updateActionsVisibility === 'function') window.updateActionsVisibility();
    if (typeof window.renderSick === 'function') window.renderSick();
    if (typeof window.renderDead === 'function') window.renderDead();
    loadHerd();
    loadNewlyAdded();
    if (F.isSuperSuper()) loadUsers();
  }

  async function unlock() {
    const pass = document.getElementById('owPass').value;
    if (!pass) return;
    msg('owGateMsg', 'Go a sekasekwa...', true);
    const res = await F.adminLogin(pass);
    if (res.ok) showPanel();
    else msg('owGateMsg', (res.error === 'Wrong password' ? 'Password e fosagetse. (Wrong password.)' : res.error), false);
  }

  function lock() { F.adminLogout(); refreshButton(); if (typeof window.loadGroup === 'function') window.loadGroup(); if (typeof window.updateActionsVisibility === 'function') window.updateActionsVisibility(); if (typeof window.renderSick === 'function') window.renderSick(); if (typeof window.renderDead === 'function') window.renderDead(); showGate(); }

  async function loadHerd() {
    try {
      herd = await F.loadHerd();
      herdById = {};
      document.getElementById('owHerd').innerHTML = herd.map((a) => `<option value="${esc(a.id)}">`).join('');
      herd.forEach((a) => {
        herdById[a.id] = a;
        herdById[String(a.id || '').trim().toUpperCase()] = a;
      });
    } catch (e) {
      msg('linMsg', 'Ga go kgonege go laisa dikgomo. Netefatsa inthanete. (Could not load. Check connection.)', false);
    }
  }

  async function onPickAnimal() {
    const id = document.getElementById('linPick').value.trim();
    const a = herdById[id];
    clearMsg('linMsg'); clearMsg('cmtMsg');
    document.getElementById('linMma').value = a && a.motherId ? a.motherId : '';
    document.getElementById('linRre').value = a && a.fatherId ? a.fatherId : '';
    document.getElementById('linSex').value = a && a.sex ? a.sex : '';
    document.getElementById('linDob').value = a && a.dateOfBirth ? a.dateOfBirth : '';
    document.getElementById('linMeta').textContent = a && a.updatedBy ? ('Tlhabolotswe ke ' + a.updatedBy + ' (last edited by ' + a.updatedBy + ')') : '';
    document.getElementById('cmtList').innerHTML = '';
    if (a) loadComments(id);
  }

  async function loadComments(id) {
    const res = await F.getComments(id);
    if (authFailed(res)) return;
    const list = document.getElementById('cmtList');
    if (!res.ok) { list.innerHTML = ''; return; }
    if (!res.comments.length) { list.innerHTML = '<div class="ow-meta">Ga go na dikakanyo. (No comments yet.)</div>'; return; }
    list.innerHTML = res.comments.map((c) => {
      const d = c.created_at ? new Date(c.created_at).toLocaleDateString('en-ZA') : '';
      return `<div class="ow-comment">${esc(c.comment)}<div class="ow-cmeta">${esc(c.author || '')} · ${esc(d)}</div></div>`;
    }).join('');
  }

  async function saveLineage() {
    const id = document.getElementById('linPick').value.trim();
    if (!id) { msg('linMsg', 'Kgetha kgomo pele. (Choose an animal first.)', false); return; }
    if (!herdById[id]) { msg('linMsg', 'Kgomo ga e teng. (No such animal.)', false); return; }
    const btn = document.getElementById('linSave');
    btn.disabled = true; btn.textContent = 'Go boloka...';
    const res = await F.updateLineage(id, {
      motherId: document.getElementById('linMma').value.trim(),
      fatherId: document.getElementById('linRre').value.trim(),
      sex: document.getElementById('linSex').value,
      dateOfBirth: document.getElementById('linDob').value || null,
    });
    btn.disabled = false; btn.textContent = 'Boloka Lotso';
    if (authFailed(res)) return;
    if (res.ok) { msg('linMsg', 'Bolokilwe! ✓ (Saved.)', true); await loadHerd(); }
    else msg('linMsg', 'Phoso: ' + (res.error || ''), false);
  }

  async function addComment() {
    const id = document.getElementById('linPick').value.trim();
    const text = document.getElementById('cmtBox').value.trim();
    if (!text) { msg('cmtMsg', 'Kwala kakanyo pele. (Write something first.)', false); return; }
    const btn = document.getElementById('cmtAdd');
    btn.disabled = true;
    const res = await F.addComment({ livestockId: id || null, comment: text });
    btn.disabled = false;
    if (authFailed(res)) return;
    if (res.ok) {
      document.getElementById('cmtBox').value = '';
      msg('cmtMsg', 'Engaditswe! ✓ (Added.)', true);
      if (id) loadComments(id);
    } else msg('cmtMsg', 'Phoso: ' + (res.error || ''), false);
  }

  async function saveCalf() {
    const id = document.getElementById('calfId').value.trim();
    if (!id) { msg('calfMsg', 'Tsenya nomoro. (Enter a tag number.)', false); return; }
    const btn = document.getElementById('calfSave');
    btn.disabled = true; btn.textContent = 'Go kwadisa...';
    const res = await F.registerCalf({
      id,
      motherId: document.getElementById('calfMma').value.trim(),
      fatherId: document.getElementById('calfRre').value.trim(),
      sex: document.getElementById('calfSex').value,
      dateOfBirth: document.getElementById('calfDob').value || null,
    });
    btn.disabled = false; btn.textContent = 'Kwadisa Namane';
    if (authFailed(res)) return;
    if (res.ok) {
      msg('calfMsg', 'Namane e kwadisitswe! ✓ (Calf registered.)', true);
      ['calfId', 'calfMma', 'calfRre', 'calfDob'].forEach((i) => { document.getElementById(i).value = ''; });
      document.getElementById('calfSex').value = '';
      await loadHerd();
    } else msg('calfMsg', 'Phoso: ' + (res.error || ''), false);
  }

  // ---- accounts (supersuper) ----
  async function loadUsers() {
    const res = await F.listUsers();
    if (authFailed(res)) return;
    const box = document.getElementById('owUserList');
    if (!res.ok) { box.innerHTML = '<div class="ow-meta">' + esc(res.error || '') + '</div>'; return; }
    const me = (F.getUser() || {}).name;
    box.innerHTML = res.users.map((u) => {
      const pill = u.role === 'supersuper' ? '<span class="ow-pill super2">supersuper</span>' : '<span class="ow-pill">super</span>';
      const del = u.name === me ? '' : `<button class="ow-del" data-name="${esc(u.name)}">Phimola</button>`;
      return `<div class="ow-uitem"><span><span class="ow-uname">${esc(u.name)}</span>${pill}</span>${del}</div>`;
    }).join('');
    box.querySelectorAll('.ow-del').forEach((b) => { b.onclick = () => removeUser(b.getAttribute('data-name')); });
  }

  async function createUser() {
    const name = document.getElementById('auName').value.trim();
    const password = document.getElementById('auPass').value;
    const role = document.getElementById('auRole').value;
    if (!name || !password) { msg('auMsg', 'Tsenya leina le password. (Name and password needed.)', false); return; }
    const btn = document.getElementById('auCreate');
    btn.disabled = true;
    const res = await F.createUser({ name, password, role });
    btn.disabled = false;
    if (authFailed(res)) return;
    if (res.ok) {
      msg('auMsg', 'Akhaonto e tlhamilwe! ✓ (Account created.)', true);
      document.getElementById('auName').value = '';
      document.getElementById('auPass').value = '';
      loadUsers();
    } else msg('auMsg', 'Phoso: ' + (res.error || ''), false);
  }

  async function removeUser(name) {
    if (!confirm('Phimola akhaonto ya ' + name + '? (Delete this account?)')) return;
    const res = await F.deleteUser(name);
    if (authFailed(res)) return;
    if (res.ok) { msg('auMsg', 'Phimotswe. (Deleted.)', true); loadUsers(); }
    else msg('auMsg', 'Phoso: ' + (res.error || ''), false);
  }

  // ---- OCR scanner (logged-in only) ----
  let scanRows = [];
  let scanDate = '';

  function buildScan() {
    const b = document.createElement('button');
    b.id = 'ocrBtn';
    b.style.display = 'none';
    b.innerHTML = '<span>\U0001F4F7</span><span>Bala</span>';
    b.onclick = openScan;
    document.body.appendChild(b);

    const m = document.createElement('div');
    m.id = 'ocrModal';
    m.className = 'ow-overlay ow-hidden';
    m.innerHTML = `
      <div class="ow-card">
        <span class="ow-x" id="ocrClose">&times;</span>
        <h2>Bala Dinomoro (Scan numbers)</h2>
        <p>Tsea senepe kgotsa o rekote lentswe la dinomoro, mme o tlhole pele o boloka. (Photo or voice note, then check before saving.)</p>
        <input type="file" id="ocrFile" accept="image/*" multiple style="display:none">
        <button class="ow-btn" id="ocrPick">📷 Tsea ditshwantsho (Choose photo sheet(s))</button>
        <input type="file" id="ocrAudio" accept="audio/*" style="display:none">
        <button class="ow-btn ow-btn-grey" id="ocrVoice" style="margin-top:8px">🎤 Dirisa lentswe (Use voice / live mic)</button>
        <div class="ow-msg" id="ocrMsg"></div>
        <div id="ocrReview" style="display:none">
          <div class="ow-meta" id="ocrSummary"></div>
          <div class="ow-field" style="margin:10px 0">
            <label for="ocrDate">Letsatsi la senepe (Date on the sheet)</label>
            <input type="date" id="ocrDate" class="ow-input">
            <div class="ow-msg" id="ocrDateNote"></div>
          </div>
          <div class="ow-inline-help">Review the scanned values, use the Edit button if a number needs fixing, and switch the type to Calf for letter-marked calf entries before applying.</div>
          <div id="ocrRows" class="ow-list"></div>
          <button class="ow-btn" id="ocrApply">Tshwaya Teng + Tlatsa Registry (Mark present + update registry)</button>
        </div>
      </div>`;
    document.body.appendChild(m);

    document.getElementById('ocrClose').onclick = closeScan;
    document.getElementById('ocrPick').onclick = function () { document.getElementById('ocrFile').click(); };
    document.getElementById('ocrFile').addEventListener('change', onPhoto);
    document.getElementById('ocrApply').onclick = applyScan;
    document.getElementById('ocrVoice').onclick = function () {
      if (getSpeechRecognitionCtor()) startLiveVoice();
      else document.getElementById('ocrAudio').click();
    };
    document.getElementById('ocrAudio').addEventListener('change', onVoice);
  }

  async function openScan() {
    document.getElementById('ocrModal').classList.remove('ow-hidden');
    document.getElementById('ocrReview').style.display = 'none';
    clearMsg('ocrMsg');
    scanRows = [];
    if (!herd.length) { try { await loadHerd(); } catch (e) {} }
  }
  function closeScan() { document.getElementById('ocrModal').classList.add('ow-hidden'); }

  function scanRowKind(value) {
    const v = String(value || '').trim().toUpperCase();
    const known = herdById[v];
    if (known && known.group === 'calves') return 'calf';
    if (/^[A-Z]+$/.test(v)) return 'calf';
    if (/^[0-9]{1,2}$/.test(v)) return 'calf';
    if (/^[A-Z0-9-]*[A-Z][A-Z0-9-]*$/.test(v)) return 'calf';
    return 'cow';
  }

  function mergeScanRows(numbers) {
    const seen = new Set(scanRows.map(function (r) { return String(r.value || '').trim().toUpperCase(); }));
    numbers.forEach(function (n) {
      const value = String(n || '').trim();
      if (!value) return;
      const key = value.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);
      scanRows.push({ value: value, present: true, kind: scanRowKind(value) });
    });
  }

  function fileToScaledBase64(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality || 0.7).split('base64,')[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(String(r.result).split('base64,')[1]); };
      r.onerror = function () { reject(new Error('read')); };
      r.readAsDataURL(file);
    });
  }

  function isConfigError(res) {
    const err = String((res && res.error) || '');
    return !!(res && (res.code === 'CONFIG' || /Missing environment variable: OPENAI_API_KEY/i.test(err) || /not configured/i.test(err)));
  }

  let tesseractLoader = null;
  function ensureTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractLoader) return tesseractLoader;
    tesseractLoader = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.async = true;
      s.onload = function () {
        if (window.Tesseract) resolve(window.Tesseract);
        else reject(new Error('ocr library missing'));
      };
      s.onerror = function () { reject(new Error('ocr load failed')); };
      document.head.appendChild(s);
    });
    return tesseractLoader;
  }

  function wordsToDigits(text) {
    const map = {
      zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
      six: '6', seven: '7', eight: '8', nine: '9', dash: '-', hyphen: '-', minus: '-'
    };
    return String(text || '').replace(
      /\b(zero|oh|one|two|three|four|five|six|seven|eight|nine|dash|hyphen|minus)\b(?:[\s,]+(zero|oh|one|two|three|four|five|six|seven|eight|nine|dash|hyphen|minus)\b)+/gi,
      function (m) {
        return m.split(/[\s,]+/).map(function (part) { return map[String(part || '').toLowerCase()] || part; }).join('');
      }
    );
  }

  function toIsoDate(day, month, year) {
    const d = String(day || '').padStart(2, '0');
    const m = String(month || '').padStart(2, '0');
    const y = String(year || '');
    if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return '';
    return y + '-' + m + '-' + d;
  }

  function extractScanDate(text) {
    const raw = wordsToDigits(text).replace(/[\r\n]+/g, ' ');
    const numeric = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    if (numeric) {
      const year = numeric[3].length === 2 ? ('20' + numeric[3]) : numeric[3];
      return toIsoDate(numeric[1], numeric[2], year);
    }
    const months = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
    };
    const lower = raw.toLowerCase();
    let named = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/);
    if (named) return toIsoDate(named[1], months[named[2]], named[3]);
    named = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
    if (named) return toIsoDate(named[1], months[named[2]], '2026');
    return '';
  }

  function extractScanNumbers(text) {
    const normalized = wordsToDigits(text)
      .toUpperCase()
      .replace(/[|]/g, '1')
      .replace(/[O]/g, '0');
    const matches = normalized.match(/\b[A-Z]{1,3}\b|\b\d{1,5}(?:-\d{1,3})?\b/g) || [];
    const out = [];
    const seen = new Set();
    matches.forEach(function (token) {
      const value = String(token || '').trim();
      if (!value) return;
      const ok = /^[A-Z]{1,3}$/.test(value)
        || /^\d{1,2}$/.test(value)
        || /^\d{3}$/.test(value)
        || /^\d{4}$/.test(value)
        || (/^\d{5}$/.test(value) && /^(11|55|56|58|72|73|74|76|31)\d{3}$/.test(value))
        || /^\d{2,3}-\d{1,3}$/.test(value);
      if (!ok) return;
      if (seen.has(value)) return;
      seen.add(value);
      out.push(value);
    });
    return out;
  }

  async function scanPhotoLocal(file) {
    const Tesseract = await ensureTesseract();
    const result = await Tesseract.recognize(file, 'eng');
    const text = String(result && result.data && result.data.text || '');
    return {
      ok: true,
      numbers: extractScanNumbers(text),
      date: extractScanDate(text) || null,
      text: text
    };
  }

  function getSpeechRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function applyVoiceTranscript(transcript) {
    const parsedText = wordsToDigits(transcript);
    const numbers = extractScanNumbers(parsedText);
    const date = extractScanDate(parsedText);
    if (!numbers.length) {
      msg('ocrMsg', 'Ga go na dinomoro tse di utlwilweng. (No numbers heard.)' + (transcript ? ' “' + transcript + '”' : ''), false);
      return;
    }
    clearMsg('ocrMsg');
    scanRows = numbers.map(function (n) {
      const value = String(n || '').trim();
      return { value: value, present: true, kind: scanRowKind(value) };
    });
    scanDate = date || '';
    var di0 = document.getElementById('dateInput');
    var odIn = document.getElementById('ocrDate');
    if (odIn) odIn.value = scanDate || (di0 ? di0.value : '');
    var dnote = document.getElementById('ocrDateNote');
    if (dnote) dnote.textContent = scanDate
      ? 'Letsatsi le utlwilwe mo lentsweng. (Date heard in the voice input.)'
      : 'Ga go letsatsi le le utlwilweng, netefatsa le le fa godimo. (No date heard, confirm above.)';
    renderRows();
    document.getElementById('ocrReview').style.display = '';
    msg('ocrMsg', 'Se se utlwilweng: “' + transcript + '”', true);
  }

  function startLiveVoice() {
    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      document.getElementById('ocrAudio').click();
      return;
    }
    document.getElementById('ocrReview').style.display = 'none';
    msg('ocrMsg', 'Bua dinomoro jaanong... (Speak the numbers now.)', true);
    const rec = new SR();
    rec.lang = 'en-ZA';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let done = false;
    rec.onresult = function (event) {
      done = true;
      const transcript = Array.from(event.results || []).map(function (res) {
        return res && res[0] ? res[0].transcript : '';
      }).join(' ').trim();
      applyVoiceTranscript(transcript);
    };
    rec.onerror = function () {
      done = true;
      msg('ocrMsg', 'Ga go kgonege go reetsa lentswe mo browser eno. (Could not use live voice on this browser.)', false);
    };
    rec.onend = function () {
      if (!done) msg('ocrMsg', 'Ga go na lentswe le le utlwilweng. (No voice captured.)', false);
    };
    try { rec.start(); }
    catch (e) { msg('ocrMsg', 'Ga go kgonege go simolola lentswe. (Could not start live voice.)', false); }
  }

  async function onVoice(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    document.getElementById('ocrReview').style.display = 'none';
    msg('ocrMsg', 'Go reediwa lentswe... (Listening, please wait.)', true);
    let b64;
    try { b64 = await fileToBase64(file); }
    catch (err) { msg('ocrMsg', 'Ga go kgonege go bula rekoto. (Could not open the recording.)', false); return; }
    const res = await F.scanVoice(b64, file.type || 'audio/m4a');
    if (authFailed(res)) { closeScan(); return; }
    if (!res.ok && isConfigError(res) && getSpeechRecognitionCtor()) { startLiveVoice(); return; }
    if (!res.ok) { msg('ocrMsg', 'Phoso: ' + (res.error || ''), false); return; }
    if (!res.numbers || !res.numbers.length) {
      msg('ocrMsg', 'Ga go na dinomoro tse di utlwilweng. (No numbers heard.)' + (res.transcript ? ' \u201C' + res.transcript + '\u201D' : ''), false);
      return;
    }
    clearMsg('ocrMsg');
    scanRows = res.numbers.map(function (n) {
      const value = String(n || '').trim();
      return { value: value, present: true, kind: scanRowKind(value) };
    });
    scanDate = (res.date && /^\d{4}-\d{2}-\d{2}$/.test(res.date)) ? res.date : '';
    var di0 = document.getElementById('dateInput');
    var odIn = document.getElementById('ocrDate');
    if (odIn) odIn.value = scanDate || (di0 ? di0.value : '');
    var dnote = document.getElementById('ocrDateNote');
    if (dnote) dnote.textContent = scanDate
      ? 'Letsatsi le utlwilwe mo lentsweng. (Date heard in the recording.)'
      : 'Ga go letsatsi le le utlwilweng, netefatsa le le fa godimo. (No date heard, confirm above.)';
    renderRows();
    document.getElementById('ocrReview').style.display = '';
    if (res.transcript) msg('ocrMsg', 'Se se utlwilweng: \u201C' + res.transcript + '\u201D', true);
  }

  async function onPhoto(e) {
    const files = Array.from((e.target.files || []));
    e.target.value = '';
    if (!files.length) return;
    document.getElementById('ocrReview').style.display = 'none';
    msg('ocrMsg', 'Go bala ditshwantsho... (Reading the photo sheets, please wait.)', true);
    scanRows = [];
    scanDate = '';
    let dateConflicts = false;
    let useLocal = false;
    for (const file of files) {
      let res;
      if (!useLocal) {
        let b64;
        try { b64 = await fileToScaledBase64(file, 1600, 0.7); }
        catch (err) { msg('ocrMsg', 'Ga go kgonege go bula sengwe sa ditshwantsho. (Could not open one of the photos.)', false); return; }
        res = await F.scanNumbers(b64, 'image/jpeg');
        if (isConfigError(res)) {
          useLocal = true;
          msg('ocrMsg', 'Server scan ga e ise e rulaganngwe; re bala mo browser. (Server scan is not configured yet, using browser scan.)', true);
        }
      }
      if (useLocal) {
        try { res = await scanPhotoLocal(file); }
        catch (err) { msg('ocrMsg', 'Ga go kgonege go bala senepe mo browser. (Could not scan the photo in the browser.)', false); return; }
      }
      if (authFailed(res)) { closeScan(); return; }
      if (!res.ok) { msg('ocrMsg', 'Phoso: ' + (res.error || ''), false); return; }
      if (res.numbers && res.numbers.length) mergeScanRows(res.numbers);
      const thisDate = (res.date && /^\d{4}-\d{2}-\d{2}$/.test(res.date)) ? res.date : '';
      if (thisDate && !scanDate) scanDate = thisDate;
      else if (thisDate && scanDate && thisDate !== scanDate) dateConflicts = true;
    }
    if (!scanRows.length) { msg('ocrMsg', 'Ga go na dinomoro tse di fumanweng. Leka senepe se sengwe. (No numbers found. Try another photo.)', false); return; }
    clearMsg('ocrMsg');
    var di0 = document.getElementById('dateInput');
    var odIn = document.getElementById('ocrDate');
    if (odIn) odIn.value = scanDate || (di0 ? di0.value : '');
    var dnote = document.getElementById('ocrDateNote');
    if (dnote) dnote.textContent = dateConflicts
      ? 'Ditshwantsho di ne di na le matsatsi a a farologaneng; netefatsa le le fa godimo. (The sheets showed conflicting dates; confirm above.)'
      : (scanDate ? 'Letsatsi le badilwe senepeng. (Date read from the sheet.)' : 'Ga go letsatsi le le fumanweng, netefatsa le le fa godimo. (No date found, confirm above.)');
    renderRows();
    document.getElementById('ocrReview').style.display = '';
  }

  function rowStatus(v) {
    const a = herdById[String(v || '').trim().toUpperCase()];
    if (!a) return { cls: 'st-unknown', label: '?' };
    if (a.is_inactive) return { cls: 'st-inactive', label: '\u2717' };
    return { cls: 'st-ok', label: '\u2713' };
  }
  function updateSummary() {
    const total = scanRows.length;
    const matched = scanRows.filter(function (r) {
      const a = herdById[String(r.value || '').trim().toUpperCase()];
      return a && !a.is_inactive;
    }).length;
    const calves = scanRows.filter(function (r) { return r.kind === 'calf'; }).length;
    const fresh = scanRows.filter(function (r) {
      const a = herdById[String(r.value || '').trim().toUpperCase()];
      return !a;
    }).length;
    document.getElementById('ocrSummary').textContent = 'E fumane ' + total + ', tse ' + matched + ' di tshwana le leruo, tse ' + fresh + ' di ntšhwa, mme tse ' + calves + ' di beilwe mo calves. (Found ' + total + ', ' + matched + ' match the herd, ' + fresh + ' are new, and ' + calves + ' are set as calves.)';
  }
  function editScanRow(i) {
    const current = (scanRows[i] && scanRows[i].value) ? scanRows[i].value : '';
    const next = prompt('Edit scanned number', current);
    if (next === null) return;
    scanRows[i].value = String(next).trim();
    scanRows[i].kind = scanRowKind(scanRows[i].value);
    renderRows();
  }
  function renderRows() {
    const box = document.getElementById('ocrRows');
    box.innerHTML = scanRows.map(function (r, i) {
      const st = rowStatus(r.value);
      return '<div class="ow-uitem">'
        + '<span style="display:flex;align-items:center;gap:8px;flex:1">'
        + '<input type="checkbox" class="ocr-ck" data-i="' + i + '" ' + (r.present ? 'checked' : '') + ' style="width:20px;height:20px">'
        + '<input type="text" class="ow-input ocr-val" data-i="' + i + '" value="' + esc(r.value) + '" style="padding:8px;font-size:15px">'
        + '<select class="ow-input ocr-kind" data-i="' + i + '"><option value="cow"' + (r.kind === 'cow' ? ' selected' : '') + '>Cow</option><option value="calf"' + (r.kind === 'calf' ? ' selected' : '') + '>Calf</option></select>'
        + '<button type="button" class="ocr-edit" data-i="' + i + '">Edit</button>'
        + '</span>'
        + '<span class="ocr-st ' + st.cls + '">' + st.label + '</span>'
        + '</div>';
    }).join('');
    box.querySelectorAll('.ocr-ck').forEach(function (ck) { ck.onchange = function () { scanRows[+ck.dataset.i].present = ck.checked; }; });
    box.querySelectorAll('.ocr-val').forEach(function (inp) {
      inp.oninput = function () {
        scanRows[+inp.dataset.i].value = inp.value;
        const st = rowStatus(inp.value);
        const el = inp.closest('.ow-uitem').querySelector('.ocr-st');
        el.className = 'ocr-st ' + st.cls; el.textContent = st.label;
        scanRows[+inp.dataset.i].kind = scanRowKind(inp.value);
        updateSummary();
      };
    });
    box.querySelectorAll('.ocr-kind').forEach(function (sel) {
      sel.onchange = function () { scanRows[+sel.dataset.i].kind = sel.value; updateSummary(); };
    });
    box.querySelectorAll('.ocr-edit').forEach(function (btn) {
      btn.onclick = function () { editScanRow(+btn.dataset.i); };
    });
    updateSummary();
  }

  // mark the matched animals present for the selected date, exactly like a manual tick
  function applyPresent(ids) {
    if (typeof attendance === 'undefined' || typeof selectedDate === 'undefined' || typeof currentGroup === 'undefined') return false;
    const key = currentGroup + '_' + selectedDate;
    if (!attendance[key]) attendance[key] = {};
    ids.forEach(function (id) { attendance[key][id] = true; });
    try { localStorage.setItem('dikgomo_attendance', JSON.stringify(attendance)); } catch (e) {}
    if (typeof loadGroup === 'function') loadGroup();
    if (typeof updateStats === 'function') updateStats();
    return true;
  }

  async function applyScan() {
    const matched = [], unmatched = [];
    scanRows.forEach(function (r) {
      const v = (r.value || '').trim();
      if (!r.present || !v) return;
      const existing = herdById[String(v).toUpperCase()];
      if (existing && !existing.is_inactive) matched.push(existing.id);
      else unmatched.push({ value: v, kind: r.kind || scanRowKind(v) });
    });
    if (!matched.length && !unmatched.length) { msg('ocrMsg', 'Ga go na nomoro e e tshwanetseng go tsenngwa. (Nothing selected to apply.)', false); return; }
    var odA = document.getElementById('ocrDate');
    var chosenDate = odA ? odA.value : '';
    if (chosenDate && /^\d{4}-\d{2}-\d{2}$/.test(chosenDate)) {
      var diA = document.getElementById('dateInput');
      if (diA) { diA.value = chosenDate; if (typeof updateDateDisplay === 'function') updateDateDisplay(); }
    }
    const created = [];
    const failed = [];
    for (const row of unmatched) {
      const res = await F.registerCalf({
        id: row.value,
        group: row.kind === 'calf' ? 'calves' : undefined,
        comment: 'Imported from register photo' + (chosenDate ? (' on ' + chosenDate) : '')
      });
      if (authFailed(res)) { closeScan(); return; }
      if (res && res.ok) created.push(row.value);
      else failed.push(row.value + (res && res.error ? (' (' + res.error + ')') : ''));
    }
    if (created.length) {
      await loadHerd();
      if (typeof LIVESTOCK_DATA !== 'undefined') LIVESTOCK_DATA = herd.slice();
      if (typeof window.loadGroup === 'function') window.loadGroup();
    }
    const allPresent = matched.concat(created);
    if (!allPresent.length) { msg('ocrMsg', failed.length ? ('Ga go na tsotlhe tse di tsentsweng. Failed: ' + failed.join(', ')) : 'Ga go na nomoro e e tshwanang le leruo. (Nothing matched the herd.)', false); return; }
    if (!applyPresent(allPresent)) { msg('ocrMsg', 'Ga go kgonege go tshwaya mo skrineng se. (Could not mark on this screen.)', false); return; }
    if (typeof window.auditLog === 'function') window.auditLog('scan_applied', null, allPresent.length + ' marked' + (created.length ? (', ' + created.length + ' added to registry') : '') + (chosenDate ? ', ' + chosenDate : ''));
    // push straight to the shared cloud register so it lands on every phone
    if (typeof window.syncAttendanceCloud === 'function') {
      var sdate = (typeof selectedDate !== 'undefined') ? selectedDate : (chosenDate || '');
      window.syncAttendanceCloud(sdate).then(function (r) {
        if (r && r.ok) msg('ocrMsg', (allPresent.length + ' di tshwailwe + di romilwe go difounu tsotlhe. (' + allPresent.length + ' marked + synced to all phones.)'), true);
      });
    }
    let t = allPresent.length + ' di tshwailwe teng. (' + allPresent.length + ' marked present.)';
    if (chosenDate) t += ' Letsatsi: ' + chosenDate + '.';
    if (created.length) t += ' Tse di engaditsweng mo registry: ' + created.join(', ') + '.';
    if (failed.length) t += ' Tse di paletsweng: ' + failed.join(', ') + '.';
    msg('ocrMsg', t, true);
    document.getElementById('ocrReview').style.display = 'none';
  }

  // ---- per-animal editor (logged-in only): number, parents, name, birth date, comment ----
  function buildAnimEditor() {
    const m = document.createElement('div');
    m.id = 'animModal'; m.className = 'ow-overlay ow-hidden';
    m.innerHTML = `
      <div class="ow-card">
        <span class="ow-x" id="animClose">&times;</span>
        <h2>Edit animal</h2>
        <div id="animMeta" class="ow-meta"></div>
        <div class="ow-grid ow-grid-3">
          <div class="ow-field"><label for="animNum">Number</label><input type="text" id="animNum" class="ow-input"></div>
          <div class="ow-field"><label for="animMother">Mother</label><input list="owHerd" type="text" id="animMother" class="ow-input" placeholder="Mother number"></div>
          <div class="ow-field"><label for="animFather">Father</label><input list="owHerd" type="text" id="animFather" class="ow-input" placeholder="Father number"></div>
        </div>
        <div class="ow-field"><label for="animName">Name</label><input type="text" id="animName" class="ow-input" placeholder="e.g. Rikus"></div>
        <div class="ow-field"><label for="animDob">Birth date</label><input type="date" id="animDob" class="ow-input"></div>
        <div class="ow-field"><label for="animCmt">Comment / note</label><textarea id="animCmt" class="ow-input" rows="2" placeholder="Optional note"></textarea></div>
        <button class="ow-btn" id="animSave">Save</button>
        <div class="ow-msg" id="animMsg"></div>
        <div id="animCmtList" class="ow-comments"></div>
      </div>`;
    document.body.appendChild(m);
    document.getElementById('animClose').onclick = function () { document.getElementById('animModal').classList.add('ow-hidden'); };
    document.getElementById('animSave').onclick = saveAnimEdit;
  }

  async function farmEditAnimal(id) {
    if (!F.isAdmin()) return;
    if (!herd.length) { try { await loadHerd(); } catch (e) {} }
    const a = herdById[id] || { id: id };
    animEditingId = id;
    document.getElementById('animModal').classList.remove('ow-hidden');
    document.getElementById('animNum').value = a.id || id;
    document.getElementById('animMother').value = a.motherId || '';
    document.getElementById('animFather').value = a.fatherId || '';
    document.getElementById('animName').value = a.name || '';
    document.getElementById('animDob').value = a.dateOfBirth || '';
    document.getElementById('animCmt').value = '';
    document.getElementById('animMeta').textContent = a.updatedBy ? ('Last edited by ' + a.updatedBy) : '';
    clearMsg('animMsg');
    document.getElementById('animCmtList').innerHTML = '';
    loadAnimComments(id);
  }

  async function loadAnimComments(id) {
    const res = await F.getComments(id);
    if (authFailed(res)) return;
    const list = document.getElementById('animCmtList');
    if (!res.ok) { list.innerHTML = ''; return; }
    if (!res.comments.length) { list.innerHTML = '<div class="ow-meta">No comments yet.</div>'; return; }
    list.innerHTML = res.comments.map(function (c) {
      const d = c.created_at ? new Date(c.created_at).toLocaleDateString('en-ZA') : '';
      return '<div class="ow-comment">' + esc(c.comment) + '<div class="ow-cmeta">' + esc(c.author || '') + ' \u00b7 ' + esc(d) + '</div></div>';
    }).join('');
  }

  async function saveAnimEdit() {
    const oldId = animEditingId;
    const newId = document.getElementById('animNum').value.trim();
    const motherId = document.getElementById('animMother').value.trim();
    const fatherId = document.getElementById('animFather').value.trim();
    const name = document.getElementById('animName').value.trim();
    const dob = document.getElementById('animDob').value || null;
    const comment = document.getElementById('animCmt').value.trim();
    if (!newId) { msg('animMsg', 'Number cannot be empty.', false); return; }
    const btn = document.getElementById('animSave'); btn.disabled = true; btn.textContent = 'Saving...';
    const res = await F.editAnimal({ id: oldId, newId: newId, name: name, dateOfBirth: dob, comment: comment });
    if (authFailed(res)) { btn.disabled = false; btn.textContent = 'Save'; return; }
    if (!res.ok) { btn.disabled = false; btn.textContent = 'Save'; msg('animMsg', 'Error: ' + (res.error || ''), false); return; }
    const finalId = res.id || newId;
    const lineageRes = await F.updateLineage(finalId, { motherId: motherId, fatherId: fatherId });
    btn.disabled = false; btn.textContent = 'Save';
    if (authFailed(lineageRes)) return;
    if (!lineageRes.ok) { msg('animMsg', 'Error: ' + (lineageRes.error || ''), false); return; }
    if (finalId !== oldId) localRename(oldId, finalId);
    else if (typeof window.loadGroup === 'function') window.loadGroup();
    await loadHerd();
    msg('animMsg', 'Saved.', true);
    document.getElementById('animCmt').value = '';
    animEditingId = finalId;
    document.getElementById('animNum').value = finalId;
    document.getElementById('animMother').value = motherId;
    document.getElementById('animFather').value = fatherId;
    loadAnimComments(finalId);
  }

  // when a number changes, keep the local daily list + its ticks in step
  function localRename(oldId, newId) {
    try {
      if (typeof LIVESTOCK_DATA !== 'undefined' && Array.isArray(LIVESTOCK_DATA)) {
        const it = LIVESTOCK_DATA.find(function (l) { return l.id === oldId; });
        if (it) it.id = newId;
        try { localStorage.setItem('dikgomo_livestock', JSON.stringify(LIVESTOCK_DATA)); } catch (e) {}
      }
      if (typeof attendance !== 'undefined' && attendance) {
        Object.keys(attendance).forEach(function (k) {
          if (attendance[k] && Object.prototype.hasOwnProperty.call(attendance[k], oldId)) {
            attendance[k][newId] = attendance[k][oldId];
            delete attendance[k][oldId];
          }
        });
        try { localStorage.setItem('dikgomo_attendance', JSON.stringify(attendance)); } catch (e) {}
      }
      if (typeof window.loadGroup === 'function') window.loadGroup();
      if (typeof window.updateStats === 'function') window.updateStats();
    } catch (e) {}
  }

  // ---- Sick / Dead entry editor (logged-in only): comment + add/remove ----
  let sdEditing = { id: null, type: 'sick' };
  function buildSickDeadEditor() {
    const m = document.createElement('div');
    m.id = 'sdModal'; m.className = 'ow-overlay ow-hidden';
    m.innerHTML = `
      <div class="ow-card">
        <span class="ow-x" id="sdClose">&times;</span>
        <h2 id="sdTitle">Edit</h2>
        <div id="sdMeta" class="ow-meta"></div>
        <button class="ow-btn" id="sdToggle" style="margin-top:10px"></button>
        <div class="ow-field" style="margin-top:14px"><label for="sdCmt">Dikakanyo (Comment / note)</label><textarea id="sdCmt" class="ow-input" rows="2" placeholder="Kwala kakanyo..."></textarea></div>
        <button class="ow-btn ow-btn-grey" id="sdAddCmt">Engadisa Kakanyo (Add comment)</button>
        <div class="ow-msg" id="sdMsg"></div>
        <div id="sdCmtList" class="ow-comments"></div>
      </div>`;
    document.body.appendChild(m);
    document.getElementById('sdClose').onclick = function () { document.getElementById('sdModal').classList.add('ow-hidden'); };
    document.getElementById('sdAddCmt').onclick = sdAddComment;
    document.getElementById('sdToggle').onclick = sdToggleMembership;
  }
  function sdInList(id, type) {
    if (type === 'dead') return !!(window.isDead && window.isDead(id));
    return !!(window.isSick && window.isSick(id));
  }
  function sdRefreshToggle() {
    const id = sdEditing.id, type = sdEditing.type;
    const inList = sdInList(id, type);
    const btn = document.getElementById('sdToggle');
    if (type === 'dead') btn.textContent = inList ? 'Tlosa mo go Sule (Remove)' : 'Tsenya mo go Sule (Add)';
    else btn.textContent = inList ? 'Tlosa mo Bolwetse (Remove)' : 'Tsenya mo Bolwetse (Add)';
    btn.style.background = inList ? '#ef4444' : '';
  }
  function sdToggleMembership() {
    const id = sdEditing.id, type = sdEditing.type;
    const inList = sdInList(id, type);
    if (type === 'dead') { if (window.setDeadState) window.setDeadState(id, !inList); }
    else { if (window.setSickState) window.setSickState(id, !inList); }
    sdRefreshToggle();
    msg('sdMsg', inList ? 'Tlositswe. \u2713 (Removed.)' : 'Tsentswe. \u2713 (Added.)', true);
  }
  async function sdAddComment() {
    const id = sdEditing.id, type = sdEditing.type;
    const text = document.getElementById('sdCmt').value.trim();
    if (!text) { msg('sdMsg', 'Kwala kakanyo pele. (Write something first.)', false); return; }
    const tag = type === 'dead' ? '[Sule] ' : '[Bolwetse] ';
    const btn = document.getElementById('sdAddCmt'); btn.disabled = true;
    const res = await F.addComment({ livestockId: id, comment: tag + text });
    btn.disabled = false;
    if (authFailed(res)) return;
    if (res.ok) { document.getElementById('sdCmt').value = ''; msg('sdMsg', 'Engaditswe! \u2713 (Added.)', true); sdLoadComments(id); }
    else msg('sdMsg', 'Phoso: ' + (res.error || ''), false);
  }
  async function sdLoadComments(id) {
    const res = await F.getComments(id);
    if (authFailed(res)) return;
    const list = document.getElementById('sdCmtList');
    if (!res.ok) { list.innerHTML = ''; return; }
    if (!res.comments.length) { list.innerHTML = '<div class="ow-meta">Ga go na dikakanyo. (No comments yet.)</div>'; return; }
    list.innerHTML = res.comments.map(function (c) {
      const d = c.created_at ? new Date(c.created_at).toLocaleDateString('en-ZA') : '';
      return '<div class="ow-comment">' + esc(c.comment) + '<div class="ow-cmeta">' + esc(c.author || '') + ' \u00b7 ' + esc(d) + '</div></div>';
    }).join('');
  }
  async function farmSickDeadEdit(id, type) {
    if (!F.isAdmin()) return;
    type = (type === 'dead') ? 'dead' : 'sick';
    sdEditing = { id: id, type: type };
    document.getElementById('sdModal').classList.remove('ow-hidden');
    document.getElementById('sdTitle').textContent = (type === 'dead' ? 'Sule (Dead): ' : 'Bolwetse (Sick): ') + id;
    document.getElementById('sdMeta').textContent = 'Tlosa fa go le phoso, kgotsa o engadise kakanyo. (Fix a wrong entry, or add a note.)';
    document.getElementById('sdCmt').value = '';
    clearMsg('sdMsg');
    document.getElementById('sdCmtList').innerHTML = '';
    sdRefreshToggle();
    sdLoadComments(id);
  }
  window.farmSickDeadEdit = farmSickDeadEdit;

  // ---- Audit Trail (owner-only): everything that has been done ----
  function buildAuditModal() {
    const m = document.createElement('div');
    m.id = 'auditModal'; m.className = 'ow-overlay ow-hidden';
    m.innerHTML = `
      <div class="ow-card" style="max-width:560px">
        <span class="ow-x" id="auClose">&times;</span>
        <h2>Audit Trail</h2>
        <div class="ow-meta">Dintlha tsotlhe tse di dirilweng (Everything that has been recorded)</div>
        <button class="ow-btn ow-btn-grey" id="auRefresh" style="margin:10px 0">Tsosolosa (Refresh)</button>
        <div class="ow-msg" id="auMsg"></div>
        <div id="auList" class="ow-comments"></div>
      </div>`;
    document.body.appendChild(m);
    document.getElementById('auClose').onclick = function () { document.getElementById('auditModal').classList.add('ow-hidden'); };
    document.getElementById('auRefresh').onclick = loadAudit;
  }
  function auditLabel(a) {
    const map = {
      sick_on: 'Tshwailwe bolwetse (Marked sick)',
      sick_off: 'Tlositswe mo bolwetseng (Sick removed)',
      dead_on: 'Tshwailwe sule (Marked dead)',
      dead_off: 'Tlositswe mo suleng (Dead removed)',
      comment: 'Kakanyo (Comment)',
      attendance_saved: 'Palo e bolokilwe (Attendance saved)',
      scan_applied: 'Senepe se badilwe (Scan applied)',
      calf_added: 'Namane e tsentswe (Calf added)',
      registry_added: 'Registry e engaditswe (Registry added)',
      sold: 'Rekisitswe (Sold)',
      died: 'Sule (Died)'
    };
    return map[a] || a;
  }
  function recentAddedKind(e) {
    const detail = String((e && e.detail) || '').toLowerCase();
    if (detail.indexOf('calf') >= 0) return 'Calf';
    if (detail.indexOf('cow') >= 0) return 'Cow';
    return 'Animal';
  }
  async function loadNewlyAdded() {
    const list = document.getElementById('newAddList');
    if (!list) return;
    list.innerHTML = '<div class="ow-meta">Go a laiswa... (Loading...)</div>';
    clearMsg('newAddMsg');
    const res = await F.getAudit();
    if (authFailed(res)) return;
    if (!res.ok) { list.innerHTML = ''; msg('newAddMsg', 'Phoso: ' + (res.error || ''), false); return; }
    const ev = (res.events || []).filter(function (e) {
      return e && e.livestock_id && (e.action === 'registry_added' || e.action === 'calf_added' || e.source === 'photo_import');
    }).slice(0, 30);
    if (!ev.length) {
      list.innerHTML = '<div class="ow-meta">Ga go na tse di sa tswang go engadiwa. (No recent additions yet.)</div>';
      return;
    }
    list.innerHTML = ev.map(function (e) {
      const when = e.ts ? new Date(e.ts).toLocaleString('en-ZA') : '';
      const who = esc(e.actor || '');
      const src = esc(e.source || 'owner');
      const tag = esc(e.livestock_id || '');
      const kind = esc(recentAddedKind(e));
      return '<div class="ow-comment">'
        + '<strong>' + tag + '</strong>'
        + '<div class="ow-cmeta">Type: ' + kind + ' · Added by: ' + who + '</div>'
        + '<div class="ow-cmeta">Source: ' + src + ' · Date added: ' + esc(when) + '</div>'
        + (e.detail ? ('<div class="ow-cmeta">' + esc(e.detail) + '</div>') : '')
        + '</div>';
    }).join('');
  }
  async function loadAudit() {
    const list = document.getElementById('auList');
    list.innerHTML = '<div class="ow-meta">Go a laiswa... (Loading...)</div>';
    clearMsg('auMsg');
    const res = await F.getAudit();
    if (authFailed(res)) return;
    if (!res.ok) { list.innerHTML = ''; msg('auMsg', 'Phoso: ' + (res.error || ''), false); return; }
    const ev = res.events || [];
    if (!ev.length) { list.innerHTML = '<div class="ow-meta">Ga go na dintlha. (Nothing recorded yet.)</div>'; return; }
    list.innerHTML = ev.map(function (e) {
      const d = e.ts ? new Date(e.ts).toLocaleString('en-ZA') : '';
      const who = esc(e.actor || '');
      const animal = e.livestock_id ? (' \u00b7 ' + esc(e.livestock_id)) : '';
      const det = e.detail ? ('<div class="ow-cmeta">' + esc(e.detail) + '</div>') : '';
      return '<div class="ow-comment"><strong>' + esc(auditLabel(e.action)) + '</strong>' + animal + det + '<div class="ow-cmeta">' + who + ' \u00b7 ' + esc(d) + '</div></div>';
    }).join('');
  }
  async function showAuditTrail() {
    if (!F.isAdmin()) { showGate(); return; }
    document.getElementById('auditModal').classList.remove('ow-hidden');
    loadAudit();
  }
  window.showAuditTrail = showAuditTrail;

  window.farmEditAnimal = farmEditAnimal;

  function init() { injectStyle(); build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
