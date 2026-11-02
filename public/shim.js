/* 도자의 숲 — claude.ai 아티팩트 런타임(window.claude.use)을 흉내 내는 작은 연결부.
   페이지 코드는 그대로 두고, 저장소·관리자·사진을 이 사이트의 /api 로 연결해요. */
(() => {
  const API = '/api/';
  const asJson = r => r.json().catch(() => ({})).then(b => (r.ok ? b : Promise.reject(Object.assign(new Error(b.error || 'error'), { code: b.error || r.status }))));
  let uid = null; try { uid = localStorage.getItem('dj_uid'); } catch (e) {}
  if (!uid) { uid = 'v_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); try { localStorage.setItem('dj_uid', uid); } catch (e) {} }
  let ME = null; const me = () => ME || (ME = fetch(API + 'me', { credentials: 'same-origin' }).then(r => r.json()).catch(() => ({ admin: false })));
  const ticks = new Set(); const refreshAll = () => setTimeout(() => ticks.forEach(t => t(true)), 150);
  const call = (op, body) => fetch(API + 'db', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ op }, body)) }).then(asJson).then(r => { refreshAll(); return r; });
  const snap = (path, r) => ({ id: path.split('/').pop(), exists: !!(r && r.exists), data: () => (r && r.exists ? r.data : undefined) });
  function poll(fn, cb, err) {
    let stop = false, last = null, timer = null;
    const tick = (now) => { if (stop) return; clearTimeout(timer);
      fn().then(s => { const k = JSON.stringify(s.docs ? s.docs.map(d => [d.id, d.data()]) : [s.exists, s.data()]); if (k !== last) { last = k; cb(s); } })
        .catch(e => { if (err) err(e); })
        .finally(() => { if (!stop) timer = setTimeout(tick, document.hidden ? 90000 : 25000); }); };
    ticks.add(tick); tick(); return () => { stop = true; clearTimeout(timer); ticks.delete(tick); };
  }
  function docRef(path) {
    const ref = { id: path.split('/').pop(), path,
      get: () => fetch(API + 'db?doc=' + encodeURIComponent(path), { credentials: 'same-origin' }).then(asJson).then(r => Object.assign(snap(path, r), { ref })),
      set: d => call('set', { path, data: d }).then(() => undefined),
      update: d => call('update', { path, data: d }).then(() => undefined),
      delete: () => call('delete', { path }).then(() => undefined),
      onSnapshot: (cb, err) => poll(ref.get, cb, err) };
    return ref;
  }
  function query(coll, o) {
    o = o || {};
    const q = { path: coll,
      orderBy: (f, dir) => query(coll, Object.assign({}, o, { order: f, dir: dir === 'desc' ? 'desc' : 'asc' })),
      limit: n => query(coll, Object.assign({}, o, { limit: n })),
      get: () => fetch(API + 'db?coll=' + encodeURIComponent(coll) + (o.order ? '&order=' + encodeURIComponent(o.order) + '&dir=' + o.dir : '') + (o.limit ? '&limit=' + o.limit : ''), { credentials: 'same-origin' }).then(asJson)
        .then(r => { const docs = (r.docs || []).map(d => Object.assign(snap(coll + '/' + d.id, { exists: true, data: d.data }), { ref: docRef(coll + '/' + d.id) })); return { docs, size: docs.length, empty: !docs.length }; }),
      onSnapshot: (cb, err) => poll(q.get, cb, err),
      add: d => call('add', { coll, data: d }).then(r => docRef(coll + '/' + r.id)),
      doc: id => docRef(coll + '/' + (id || Math.random().toString(36).slice(2, 14))) };
    return q;
  }
  const db = Object.freeze({ doc: docRef, collection: c => query(c) });
  const user = Object.freeze({
    isOwner: () => me().then(r => !!r.admin), canEdit: () => me().then(r => !!r.admin), can: () => null,
    id: () => Promise.resolve(uid), me: () => Promise.resolve({ id: uid, name: '', guest: false }),
    profiles: ids => Promise.resolve(Object.fromEntries((ids || []).map(i => [i, { id: i, name: '' }]))), search: () => Promise.resolve([])
  });
  const assets = Object.freeze({
    upload: blob => fetch(API + 'assets', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': blob.type || 'application/octet-stream' }, body: blob }).then(asJson),
    delete: id => fetch(API + 'assets/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' }).then(asJson),
    list: () => Promise.resolve({ assets: [], usage: {} })
  });
  // 실시간 방: 같이 있는 사람 보기·말하기
  function makeRoom() {
    const fns = new Set(), others = new Map(); let ws = null, myPeer = null, mine = null, wait = 1000, alive = true;
    const emit = () => { const peers = [...others.entries()].map(([peer, presence]) => ({ peer, presence, isMe: false, kind: 'viewer' })); if (myPeer) peers.push({ peer: myPeer, presence: mine || {}, isMe: true, kind: 'viewer' }); fns.forEach(f => { try { f({ peers }); } catch (e) {} }); };
    const connect = () => {
      if (!alive) return;
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/room'); } catch (e) { return; }
      ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'hello') { myPeer = m.peer; others.clear(); (m.peers || []).forEach(p => { if (p.peer !== myPeer && p.presence) others.set(p.peer, p.presence); }); wait = 1000; if (mine) ws.send(JSON.stringify({ t: 'p', p: mine })); emit(); }
        else if (m.t === 'p' && m.peer !== myPeer) { others.set(m.peer, m.presence); emit(); }
        else if (m.t === 'bye') { others.delete(m.peer); emit(); } };
      ws.onclose = () => { others.clear(); myPeer = null; emit(); setTimeout(connect, wait); wait = Math.min(30000, wait * 2); };
    };
    connect();
    setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"t":"ping"}'); }, 25000);
    return Object.freeze({
      presence: p => { mine = p; if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'p', p })); return Promise.resolve(); },
      onPeers: f => { fns.add(f); emit(); return () => fns.delete(f); },
      emit: () => Promise.resolve(), on: () => () => {}
    });
  }
  let ROOMP = null;
  const getRoom = () => ROOMP || (ROOMP = fetch(API + 'room', { method: 'HEAD' }).then(r => (r.status === 503 ? null : makeRoom())).catch(() => null));
  window.claude = Object.freeze({ use: name => name === 'db' ? Promise.resolve(db) : name === 'user' ? Promise.resolve(user) : name === 'assets' ? me().then(r => (r.admin ? assets : null)) : name === 'room' ? getRoom() : Promise.resolve(null) });
  // 관리자: 주소 끝에 #admin 을 붙이면 비밀번호를 물어요
  const askAdmin = () => me().then(r => {
    if (r.admin) return; const pw = prompt('관리자 비밀번호'); if (!pw) return;
    fetch(API + 'login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pw }) })
      .then(x => { if (x.ok) location.reload(); else alert('비밀번호가 맞지 않아요.'); });
  });
  if (location.hash === '#admin') askAdmin();
  addEventListener('hashchange', () => { if (location.hash === '#admin') askAdmin(); });
})();
