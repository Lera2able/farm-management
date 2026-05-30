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
      #ocrBtn{position:fixed;left:12px;bottom:60px;z-index:1500;background:#3b82f6;color:#fff;border:none;border-radius:24px;padding:10px 16px;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;align-items:center;gap:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
      #ocrBtn:active{transform:scale(.97)}
      .ocr-st{font-weight:700;padding:0 6px;white-space:nowrap}
      .ocr-st.st-ok{color:#059669}.ocr-st.st-unknown{color:#d97706}.ocr-st.st-inactive{color:#ef4444}
      .ocr-val{max-width:150px}
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
          <h2 id="owHello">Mong</h2>

          <div class="ow-section">
            <h3>Tlhabolola Lotso (Edit lineage)</h3>
            <div class="ow-field">
              <label for="linPick">Kgetha kgomo (Choose animal)</label>
              <input list="owHerd" id="linPick" class="ow-input" placeholder="Nomoro ya kgomo">
            </div>
            <div id="linMeta" class="ow-meta"></div>
            <div class="ow-field"><label for="linMma">Mma (Mother)</label><input list="owHerd" id="linMma" class="ow-input" placeholder="Nomoro ya ga mmagwe"></div>
            <div class="ow-field"><label for="linRre">Rre (Father)</label><input list="owHerd" id="linRre" class="ow-input" placeholder="Nomoro ya ga rragwe"></div>
            <div class="ow-field"><label for="linSex">Bong (Sex)</label>
              <select id="linSex" class="ow-input"><option value="">--</option><option value="M">Poo (M)</option><option value="F">Tshegadi (F)</option></select>
            </div>
            <div class="ow-field"><label for="linDob">Letlha la matsalo (Date of birth)</label><input type="date" id="linDob" class="ow-input"></div>
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
            <div class="ow-field"><label for="calfId">Nomoro (Tag number)</label><input type="text" id="calfId" class="ow-input" placeholder="P.f. 11272"></div>
            <div class="ow-field"><label for="calfMma">Mma (Mother)</label><input list="owHerd" id="calfMma" class="ow-input" placeholder="Nomoro ya ga mmagwe"></div>
            <div class="ow-field"><label for="calfRre">Rre (Father)</label><input list="owHerd" id="calfRre" class="ow-input" placeholder="Nomoro ya ga rragwe"></div>
            <div class="ow-field"><label for="calfSex">Bong (Sex)</label>
              <select id="calfSex" class="ow-input"><option value="">--</option><option value="M">Poo (M)</option><option value="F">Tshegadi (F)</option></select>
            </div>
            <div class="ow-field"><label for="calfDob">Letlha la matsalo (Date of birth)</label><input type="date" id="calfDob" class="ow-input"></div>
            <button class="ow-btn" id="calfSave">Kwadisa Namane</button>
            <div class="ow-msg" id="calfMsg"></div>
          </div>

          <div class="ow-section" id="owAccounts" style="display:none">
            <h3>Di-akhaonto (Accounts)</h3>
            <div id="owUserList" class="ow-list"></div>
            <div class="ow-field"><label for="auName">Leina (Name)</label><input id="auName" class="ow-input" placeholder="P.f. Thabo"></div>
            <div class="ow-field"><label for="auPass">Password</label><input id="auPass" class="ow-input" type="text" placeholder="Password e ntšhwa"></div>
            <div class="ow-field"><label for="auRole">Karolo (Role)</label>
              <select id="auRole" class="ow-input"><option value="super">Super (edit only)</option><option value="supersuper">Supersuper (manage accounts)</option></select>
            </div>
            <button class="ow-btn" id="auCreate">Tlhama akhaonto (Create account)</button>
            <div class="ow-msg" id="auMsg"></div>
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

    buildScan();
    buildAnimEditor();
    buildSickDeadEditor();
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
      herd.forEach((a) => { herdById[a.id] = a; });
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
        <p>Tsea senepe sa lenaneo la dinomoro, mme o tlhole pele o boloka. (Photograph the list, then check before saving.)</p>
        <input type="file" id="ocrFile" accept="image/*" style="display:none">
        <button class="ow-btn" id="ocrPick">\U0001F4F7 Tsea senepe (Take / choose photo)</button>
        <div class="ow-msg" id="ocrMsg"></div>
        <div id="ocrReview" style="display:none">
          <div class="ow-meta" id="ocrSummary"></div>
          <div class="ow-field" style="margin:10px 0">
            <label for="ocrDate">Letsatsi la senepe (Date on the sheet)</label>
            <input type="date" id="ocrDate" class="ow-input">
            <div class="ow-msg" id="ocrDateNote"></div>
          </div>
          <div id="ocrRows" class="ow-list"></div>
          <button class="ow-btn" id="ocrApply">Tshwaya Teng (Mark present)</button>
        </div>
      </div>`;
    document.body.appendChild(m);

    document.getElementById('ocrClose').onclick = closeScan;
    document.getElementById('ocrPick').onclick = function () { document.getElementById('ocrFile').click(); };
    document.getElementById('ocrFile').addEventListener('change', onPhoto);
    document.getElementById('ocrApply').onclick = applyScan;
  }

  async function openScan() {
    document.getElementById('ocrModal').classList.remove('ow-hidden');
    document.getElementById('ocrReview').style.display = 'none';
    clearMsg('ocrMsg');
    scanRows = [];
    if (!herd.length) { try { await loadHerd(); } catch (e) {} }
  }
  function closeScan() { document.getElementById('ocrModal').classList.add('ow-hidden'); }

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

  async function onPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    document.getElementById('ocrReview').style.display = 'none';
    msg('ocrMsg', 'Go bala senepe... (Reading the photo, please wait.)', true);
    let b64;
    try { b64 = await fileToScaledBase64(file, 1600, 0.7); }
    catch (err) { msg('ocrMsg', 'Ga go kgonege go bula senepe. (Could not open the photo.)', false); return; }
    const res = await F.scanNumbers(b64, 'image/jpeg');
    if (authFailed(res)) { closeScan(); return; }
    if (!res.ok) { msg('ocrMsg', 'Phoso: ' + (res.error || ''), false); return; }
    if (!res.numbers || !res.numbers.length) { msg('ocrMsg', 'Ga go na dinomoro tse di fumanweng. Leka senepe se sengwe. (No numbers found. Try another photo.)', false); return; }
    clearMsg('ocrMsg');
    scanRows = res.numbers.map(function (n) { return { value: String(n), present: true }; });
    scanDate = (res.date && /^\d{4}-\d{2}-\d{2}$/.test(res.date)) ? res.date : '';
    var di0 = document.getElementById('dateInput');
    var odIn = document.getElementById('ocrDate');
    if (odIn) odIn.value = scanDate || (di0 ? di0.value : '');
    var dnote = document.getElementById('ocrDateNote');
    if (dnote) dnote.textContent = scanDate
      ? 'Letsatsi le badilwe senepeng. (Date read from the sheet.)'
      : 'Ga go letsatsi le le fumanweng, netefatsa le le fa godimo. (No date found, confirm above.)';
    renderRows();
    document.getElementById('ocrReview').style.display = '';
  }

  function rowStatus(v) {
    const a = herdById[(v || '').trim()];
    if (!a) return { cls: 'st-unknown', label: '?' };
    if (a.is_inactive) return { cls: 'st-inactive', label: '\u2717' };
    return { cls: 'st-ok', label: '\u2713' };
  }
  function updateSummary() {
    const total = scanRows.length;
    const matched = scanRows.filter(function (r) { const a = herdById[(r.value || '').trim()]; return a && !a.is_inactive; }).length;
    document.getElementById('ocrSummary').textContent = 'E fumane ' + total + ', tse ' + matched + ' di tshwana le leruo. (Found ' + total + ', ' + matched + ' match the herd.)';
  }
  function renderRows() {
    const box = document.getElementById('ocrRows');
    box.innerHTML = scanRows.map(function (r, i) {
      const st = rowStatus(r.value);
      return '<div class="ow-uitem">'
        + '<span style="display:flex;align-items:center;gap:8px;flex:1">'
        + '<input type="checkbox" class="ocr-ck" data-i="' + i + '" ' + (r.present ? 'checked' : '') + ' style="width:20px;height:20px">'
        + '<input type="text" class="ow-input ocr-val" data-i="' + i + '" value="' + esc(r.value) + '" style="padding:8px;font-size:15px">'
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
        updateSummary();
      };
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

  function applyScan() {
    const matched = [], unmatched = [];
    scanRows.forEach(function (r) {
      const v = (r.value || '').trim();
      if (!r.present || !v) return;
      if (herdById[v] && !herdById[v].is_inactive) matched.push(v); else unmatched.push(v);
    });
    if (!matched.length) { msg('ocrMsg', 'Ga go na nomoro e e tshwanang le leruo. (Nothing matched the herd.)', false); return; }
    var odA = document.getElementById('ocrDate');
    var chosenDate = odA ? odA.value : '';
    if (chosenDate && /^\d{4}-\d{2}-\d{2}$/.test(chosenDate)) {
      var diA = document.getElementById('dateInput');
      if (diA) { diA.value = chosenDate; if (typeof updateDateDisplay === 'function') updateDateDisplay(); }
    }
    if (!applyPresent(matched)) { msg('ocrMsg', 'Ga go kgonege go tshwaya mo skrineng se. (Could not mark on this screen.)', false); return; }
    let t = matched.length + ' di tshwailwe teng. (' + matched.length + ' marked present.)';
    if (chosenDate) t += ' Letsatsi: ' + chosenDate + '.';
    if (unmatched.length) t += ' Tse di sa tshwanang: ' + unmatched.join(', ');
    msg('ocrMsg', t, true);
    document.getElementById('ocrReview').style.display = 'none';
  }

  // ---- per-animal editor (logged-in only): number, name, birth date, comment ----
  function buildAnimEditor() {
    const m = document.createElement('div');
    m.id = 'animModal'; m.className = 'ow-overlay ow-hidden';
    m.innerHTML = `
      <div class="ow-card">
        <span class="ow-x" id="animClose">&times;</span>
        <h2>Edit animal</h2>
        <div id="animMeta" class="ow-meta"></div>
        <div class="ow-field"><label for="animNum">Number</label><input type="text" id="animNum" class="ow-input"></div>
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
    const name = document.getElementById('animName').value.trim();
    const dob = document.getElementById('animDob').value || null;
    const comment = document.getElementById('animCmt').value.trim();
    if (!newId) { msg('animMsg', 'Number cannot be empty.', false); return; }
    const btn = document.getElementById('animSave'); btn.disabled = true; btn.textContent = 'Saving...';
    const res = await F.editAnimal({ id: oldId, newId: newId, name: name, dateOfBirth: dob, comment: comment });
    btn.disabled = false; btn.textContent = 'Save';
    if (authFailed(res)) return;
    if (!res.ok) { msg('animMsg', 'Error: ' + (res.error || ''), false); return; }
    const finalId = res.id || newId;
    if (finalId !== oldId) localRename(oldId, finalId);
    else if (typeof window.loadGroup === 'function') window.loadGroup();
    await loadHerd();
    msg('animMsg', 'Saved.', true);
    document.getElementById('animCmt').value = '';
    animEditingId = finalId;
    document.getElementById('animNum').value = finalId;
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

  window.farmEditAnimal = farmEditAnimal;

  function init() { injectStyle(); build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
