// 도자의 숲 API — D1(DB) · R2(BLOBS) · 관리자 비밀번호(ADMIN_PASSWORD) · 기상청 키(WEATHER_KEY, 선택)
import SEED from '../../lib/seed.json';

const J = (b, s = 200, h = {}) => new Response(JSON.stringify(b), { status: s, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, h) });
const SEG = /^[A-Za-z0-9_\-.~:@+]{1,120}$/;
const okPath = (p, even) => { const s = String(p || '').split('/'); return s.length >= 1 && s.length <= 7 && s.every(x => SEG.test(x)) && (s.length % 2 === 0) === even; };
const LIMITS = { gallery: 60000, tiles: 240000, visits: 4000 };

async function sha(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const galToken = async h => sha('doja-gal:' + h);
async function galWho(req, env) { const cur = await getDoc(env, 'secret/door'); if (!cur || !cur.h) return null; const t = await galToken(cur.h), c = req.headers.get('cookie') || ''; return c.split(/;\s*/).some(x => x === 'dj_gal=' + t) ? 'j' : null; }
async function adminToken(env) { return env.ADMIN_PASSWORD ? sha('doja:' + env.ADMIN_PASSWORD) : null; }
async function isAdmin(req, env) { const t = await adminToken(env); if (!t) return false; const c = req.headers.get('cookie') || ''; return c.split(/;\s*/).some(x => x === 'dj_admin=' + t); }

let ready = false;
async function init(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, ts INTEGER NOT NULL)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS docs_coll ON docs(coll)')
  ]);
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM docs').first();
  if (!n || !n.n) {
    const now = Date.now(), st = [];
    for (const [path, data] of Object.entries(SEED.docs || {})) { const i = path.lastIndexOf('/'); st.push(env.DB.prepare('INSERT OR IGNORE INTO docs (path, coll, id, data, ts) VALUES (?1, ?2, ?3, ?4, ?5)').bind(path, path.slice(0, i), path.slice(i + 1), JSON.stringify(data), now)); }
    for (let k = 0; k < st.length; k += 50) await env.DB.batch(st.slice(k, k + 50));
  }
  ready = true;
}
const getDoc = async (env, path) => { const r = await env.DB.prepare('SELECT data FROM docs WHERE path = ?1').bind(path).first(); return r ? JSON.parse(r.data) : null; };
const putDoc = (env, path, data) => { const i = path.lastIndexOf('/'); return env.DB.prepare('INSERT INTO docs (path, coll, id, data, ts) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(path) DO UPDATE SET data = excluded.data, ts = excluded.ts').bind(path, path.slice(0, i), path.slice(i + 1), JSON.stringify(data), Date.now()).run(); };
const merge = (a, b) => { const o = Object.assign({}, a); for (const [k, v] of Object.entries(b || {})) { if (v && typeof v === 'object' && !Array.isArray(v) && v.__delete__) delete o[k]; else if (v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) o[k] = merge(o[k], v); else o[k] = v; } return o; };

// 누가 무엇을 쓸 수 있나
// 한 번만 실행: 관리자 대신 포스터 걸기 (2026.11 소요호 마켓)
const PIN = { id: '48a8d66f817331e51fb108dfbfb29fe9', title: 'SOYOHO MARKET 수평적관계 삼덕점' };
async function pinPoster(env) {
  try { const flag = 'sys/pin_' + PIN.id; if (await getDoc(env, flag)) return; const d = (await getDoc(env, 'board/main')) || { notices: [], posters: [null, null] };
    const ps = Array.isArray(d.posters) ? d.posters : [null, null]; if (!ps.some(p => p && p.id === PIN.id)) d.posters = [PIN, ps[0] || ps[1] || null];
    await putDoc(env, 'board/main', d); await putDoc(env, flag, { at: Date.now() }); } catch (e) {}
}
function canRead(coll, admin) { const t = coll.split('/')[0]; return t === 'secret' || t === 'sys' ? false : (t === 'visits' || t === 'gosaw2611') ? admin : true; }
function canWrite(op, coll, id, admin, data) {
  const top = coll.split('/')[0];
  if (top === 'secret') return false;
  if (admin) return true;
  if (top === 'gallery' || top === 'tiles') return op === 'add' && JSON.stringify(data || {}).length <= LIMITS[top];
  if (top === 'visits') return (op === 'set' || op === 'update') && /^v_[a-z0-9]{6,40}$/.test(id) && JSON.stringify(data || {}).length <= LIMITS.visits;
  if ((top === 'guard' || top === 'yard') && coll === top) { return op === 'set' && /^v_[a-z0-9]{6,40}$/.test(id) && JSON.stringify(data || {}).length <= 300; }
  if (top === 'kiln2611' && coll === top) { const d = data || {}; return op === 'add' && JSON.stringify(d).length <= 60000 && typeof d.d === 'string' && /^v_[a-z0-9]{6,40}$/.test(String(d.uid || '')); }
  if (top === 'kilncup2611' && coll === top) { const d = data || {}; return op === 'set' && /^[a-z0-9]{6,30}__v_[a-z0-9]{6,40}$/.test(id) && JSON.stringify(d).length <= 60; }
  if (top === 'gosa2611' && coll === top) { const d = data || {}; return op === 'set' && /^v_[a-z0-9]{6,40}$/.test(id) && JSON.stringify(d).length <= 200 && Number.isInteger(d.bow) && d.bow >= 0 && d.bow <= 9999 && Number.isInteger(d.won) && d.won >= 0 && d.won <= 100000000; }
  if (/^bday-(prev|[jk]\d{4})$/.test(top) && coll === top) { const d = data || {}; return op === 'add' && JSON.stringify(d).length <= 400 && typeof d.msg === 'string' && d.msg.length <= 100; }
  if (top === 'gosaw2611' && coll === top) { const d = data || {}; return op === 'add' && JSON.stringify(d).length <= 300 && typeof d.wish === 'string' && d.wish.length <= 60; }
  if (/^(ice|shard)-\d{4}w\d{1,2}$/.test(top) && coll === top) { const d = data || {}; return op === 'set' && /^v_[a-z0-9]{6,40}$/.test(id) && JSON.stringify(d).length <= 300 && Number.isInteger(d.h) && d.h >= 0 && d.h <= 500; }
  return false;
}

// 대구 날씨: 공공데이터포털 기상청 초단기실황/초단기예보 (WEATHER_KEY 있을 때만)
// 키 없을 땐 Open-Meteo(무료·무키) 대구 현재 날씨
async function refreshOpenMeteo(env) {
  try {
    const j = await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=35.8714&longitude=128.6014&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m&wind_speed_unit=ms&timezone=Asia%2FSeoul')).json();
    const c = j.current || {}, w = +c.weather_code, cc = +c.cloud_cover, temp = +(+c.temperature_2m).toFixed(1), wind = +(+c.wind_speed_10m || 0).toFixed(1);
    if (!isFinite(temp)) return;
    let pty = 'none';
    if ([56, 57, 66, 67].includes(w)) pty = 'sleet';
    else if ((w >= 71 && w <= 77) || w === 85 || w === 86) pty = 'snow';
    else if (w >= 80 && w <= 82) pty = 'shower';
    else if ((w >= 51 && w <= 65) || w >= 95) pty = 'rain';
    const sky = w === 3 || w === 45 || w === 48 || cc >= 80 ? '흐림' : (w === 2 || cc >= 40) ? '구름많음' : '맑음';
    await putDoc(env, 'weather/daegu', { sky, pty, temp, wind, at: (c.time || '').slice(0, 16) + ':00+09:00', source: 'open-meteo', fetched: Date.now() });
  } catch (e) {}
}
async function refreshWeather(env) {
  const cur = await getDoc(env, 'weather/daegu');
  if (cur && cur.fetched && Date.now() - cur.fetched < (env.WEATHER_KEY ? 50 : 20) * 60 * 1000) return;
  if (!env.WEATHER_KEY) return refreshOpenMeteo(env);
  const k = new Date(Date.now() + 9 * 3600e3 - 45 * 60e3), ymd = k.toISOString().slice(0, 10).replace(/-/g, ''), hh = String(k.getUTCHours()).padStart(2, '0');
  const q = (op, bt) => `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${op}?serviceKey=${encodeURIComponent(env.WEATHER_KEY)}&pageNo=1&numOfRows=60&dataType=JSON&base_date=${ymd}&base_time=${bt}&nx=89&ny=90`;
  try {
    const n = await (await fetch(q('getUltraSrtNcst', hh + '00'))).json(); const items = n.response.body.items.item;
    const v = c => (items.find(x => x.category === c) || {}).obsrValue;
    const ptyN = +v('PTY'), temp = +(+v('T1H')).toFixed(1), wind = +(+v('WSD') || 0).toFixed(1);
    let sky = '맑음';
    try { const f = await (await fetch(q('getUltraSrtFcst', hh + '30'))).json(); const s = f.response.body.items.item.filter(x => x.category === 'SKY').sort((a, b) => (a.fcstDate + a.fcstTime).localeCompare(b.fcstDate + b.fcstTime))[0]; sky = { 1: '맑음', 3: '구름많음', 4: '흐림' }[+s.fcstValue] || '맑음'; } catch (e) {}
    const pty = { 0: 'none', 1: 'rain', 2: 'sleet', 3: 'snow', 5: 'rain', 6: 'sleet', 7: 'snow' }[ptyN] || 'none';
    const at = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T${hh}:00:00+09:00`;
    if (isFinite(temp)) await putDoc(env, 'weather/daegu', { sky, pty, temp, wind, at, source: '기상청 초단기실황', fetched: Date.now() }); else await refreshOpenMeteo(env);
  } catch (e) { await refreshOpenMeteo(env); }
}

export async function onRequest(ctx) {
  const { request: req, env } = ctx; const url = new URL(req.url); const route = url.pathname.replace(/^\/api\/?/, '');
  if (!env.DB) return J({ error: 'no_db' }, 500);
  await init(env);
  const admin = await isAdmin(req, env);

  if (route === 'me') return J({ admin });
  // 방문 기록: 손님도 서버에서 바로 더해요 (손님은 visits를 읽을 수 없으니까)
  if (route === 'visit' && req.method === 'POST') {
    const b = await req.json().catch(() => ({})), id = String(b.id || '');
    if (!/^v_[a-z0-9]{6,40}$/.test(id)) return J({ error: 'bad_id' }, 400);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.day || '')) ? String(b.day) : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const cur = (await getDoc(env, 'visits/' + id)) || {}; const days = cur.days && typeof cur.days === 'object' ? cur.days : {};
    if (b.add) days[day] = (Number(days[day]) || 0) + 1;
    const keys = Object.keys(days).sort().slice(-60), trimmed = {}; keys.forEach(k => trimmed[k] = days[k]);
    const nick = String(b.nick || cur.nick || '').slice(0, 12);
    await putDoc(env, 'visits/' + id, { days: trimmed, nick, last: b.add ? Date.now() : (cur.last || Date.now()) });
    return J({ ok: true });
  }
  // 현관 도어락: 비번은 해시로만 저장, 누구도 읽을 수 없음
  if (route === 'door' && req.method === 'POST') {
    const b = await req.json().catch(() => ({})), code = String(b.code || '');
    const hash = async c => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('doja-door:' + c)))].map(x => x.toString(16).padStart(2, '0')).join('');
    const cur = await getDoc(env, 'secret/door');
    if (b.set) { if (!admin) return J({ error: 'not_admin' }, 403); if (!/^\d{4}$/.test(code)) return J({ error: 'bad_code' }, 400); await putDoc(env, 'secret/door', { h: await hash(code), at: Date.now() }); return J({ ok: true, set: true }); }
    if (!cur || !cur.h) return J({ ok: false, set: false });
    // 비번을 아는 사람(케이·자판기)만: 틀리면 5번마다 10분 잠금
    const fl = (await getDoc(env, 'secret/doorfail')) || { n: 0, until: 0 };
    if (!admin && Date.now() < fl.until) return J({ ok: false, set: true, locked: Math.ceil((fl.until - Date.now()) / 1000) });
    await new Promise(r => setTimeout(r, 400));
    const ok = /^\d{4}$/.test(code) && (await hash(code)) === cur.h;
    if (!ok) { if (!admin) { fl.n = (fl.n || 0) + 1; if (fl.n >= 5) { fl.n = 0; fl.until = Date.now() + 10 * 60e3; } await putDoc(env, 'secret/doorfail', fl); } return J({ ok: false, set: true }); }
    if (fl.n) await putDoc(env, 'secret/doorfail', { n: 0, until: 0 });
    return J({ ok: true, set: true }, 200, { 'set-cookie': `dj_gal=${await galToken(cur.h)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 90}` });
  }
  // 비밀 갤러리: 케이(관리자)·자판기(문 비번으로 받은 열쇠)만
  if (route === 'sgal') {
    const who = admin ? 'k' : await galWho(req, env); if (!who) return J({ error: 'no' }, 403);
    const G = (await getDoc(env, 'secret/gallery')) || { items: [] }; G.items = Array.isArray(G.items) ? G.items : [];
    if (req.method === 'GET') return J({ who, items: G.items });
    if (req.method !== 'POST') return J({ error: 'method' }, 405);
    const b = await req.json().catch(() => ({})), it = G.items.find(x => x.id === b.pid), txt = v => String(v || '').trim().slice(0, 300);
    if (b.op === 'add') { if (!admin) return J({ error: 'not_admin' }, 403); if (!/^[0-9a-f]{32}$/.test(String(b.img || ''))) return J({ error: 'img' }, 400); if (G.items.length >= 30) return J({ error: 'full' }, 400);
      G.items.unshift({ id: [...crypto.getRandomValues(new Uint8Array(6))].map(x => x.toString(16).padStart(2, '0')).join(''), img: b.img, title: txt(b.title).slice(0, 40), at: Date.now(), r: {}, c: [] }); }
    else if (!it) return J({ error: 'none' }, 404);
    else if (b.op === 'react') { it.r = it.r || {}; const v = +b.v; if (v === 1 || v === -1) it.r[who] = v; else delete it.r[who]; }
    else if (b.op === 'comment') { const t = txt(b.text); if (!t) return J({ error: 'empty' }, 400); it.c = (it.c || []).concat([{ who, t, at: Date.now() }]).slice(-60); }
    else if (b.op === 'uncomment') { it.c = (it.c || []).filter(c => !(c.at === b.at && (c.who === who || admin))); }
    else if (b.op === 'title') { if (!admin) return J({ error: 'not_admin' }, 403); it.title = txt(b.title).slice(0, 40); }
    else if (b.op === 'del') { if (!admin) return J({ error: 'not_admin' }, 403); G.items = G.items.filter(x => x.id !== b.pid); }
    else return J({ error: 'op' }, 400);
    await putDoc(env, 'secret/gallery', G); return J({ who, items: G.items });
  }
  if (route === 'login' && req.method === 'POST') {
    const b = await req.json().catch(() => ({})); const t = await adminToken(env);
    if (!t || String(b.pw || '') !== env.ADMIN_PASSWORD) return J({ error: 'wrong' }, 401);
    return J({ ok: true }, 200, { 'set-cookie': `dj_admin=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 60}` });
  }
  if (route === 'logout') return J({ ok: true }, 200, { 'set-cookie': 'dj_admin=; Path=/; Max-Age=0' });

  if (route.startsWith('assets')) {
    if (!admin) return J({ error: 'not_granted' }, 403);
    // R2(BLOBS)가 연결 안 돼 있으면 D1 blobs 표에 저장 (1.8MB까지)
    const d1b = () => env.DB.prepare('CREATE TABLE IF NOT EXISTS blobs (id TEXT PRIMARY KEY, type TEXT NOT NULL, data BLOB NOT NULL, ts INTEGER NOT NULL)').run();
    if (req.method === 'POST') {
      const type = req.headers.get('content-type') || 'application/octet-stream'; if (!/^image\//.test(type)) return J({ error: 'type' }, 400);
      const buf = await req.arrayBuffer(); if (buf.byteLength > (env.BLOBS ? 20 * 1024 * 1024 : 1800 * 1024)) return J({ error: 'too_big' }, 413);
      const id = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
      if (env.BLOBS) await env.BLOBS.put(id, buf, { httpMetadata: { contentType: type } });
      else { await d1b(); await env.DB.prepare('INSERT INTO blobs (id, type, data, ts) VALUES (?1, ?2, ?3, ?4)').bind(id, type, buf, Date.now()).run(); }
      return J({ id, url: '/_blob/' + id, sizeBytes: buf.byteLength, contentType: type });
    }
    if (req.method === 'DELETE') { const id = route.split('/')[1]; if (/^[0-9a-f]{32}$/.test(id || '')) { if (env.BLOBS) await env.BLOBS.delete(id); try { await d1b(); await env.DB.prepare('DELETE FROM blobs WHERE id = ?1').bind(id).run(); } catch (e) {} } return J({ ok: true }); }
  }

  if (route === 'db' && req.method === 'GET') {
    const doc = url.searchParams.get('doc'), coll = url.searchParams.get('coll');
    if (doc) {
      if (!okPath(doc, true)) return J({ error: 'bad_path' }, 400);
      if (!canRead(doc.slice(0, doc.lastIndexOf('/')), admin)) return J({ exists: false });
      if (doc === 'weather/daegu') ctx.waitUntil(refreshWeather(env));
      if (doc === 'board/main') await pinPoster(env);
      const d = await getDoc(env, doc); return J(d ? { exists: true, data: d } : { exists: false });
    }
    if (coll) {
      if (!okPath(coll, false)) return J({ error: 'bad_path' }, 400);
      if (!canRead(coll, admin)) return J({ docs: [] });
      const order = url.searchParams.get('order'), dir = url.searchParams.get('dir') === 'desc' ? 'DESC' : 'ASC', lim = Math.max(1, Math.min(1000, +url.searchParams.get('limit') || 300));
      let sql = 'SELECT id, data FROM docs WHERE coll = ?1'; const args = [coll];
      if (order && /^[A-Za-z0-9_]{1,40}$/.test(order)) { sql += ` ORDER BY json_extract(data, '$.${order}') ${dir}`; }
      sql += ' LIMIT ' + lim;
      const r = await env.DB.prepare(sql).bind(...args).all();
      return J({ docs: (r.results || []).map(x => ({ id: x.id, data: JSON.parse(x.data) })) });
    }
    return J({ error: 'bad_request' }, 400);
  }

  if (route === 'db' && req.method === 'POST') {
    const b = await req.json().catch(() => null); if (!b) return J({ error: 'bad_json' }, 400);
    const op = b.op;
    if (op === 'add') {
      if (!okPath(b.coll, false)) return J({ error: 'bad_path' }, 400);
      if (!canWrite('add', b.coll, '', admin, b.data)) return J({ error: 'not_granted' }, 403);
      const id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-6);
      await putDoc(env, b.coll + '/' + id, b.data || {}); return J({ id });
    }
    const path = String(b.path || ''); if (!okPath(path, true)) return J({ error: 'bad_path' }, 400);
    const coll = path.slice(0, path.lastIndexOf('/')), id = path.slice(path.lastIndexOf('/') + 1);
    if (!canWrite(op, coll, id, admin, b.data)) return J({ error: 'not_granted' }, 403);
    if (op === 'set') { await putDoc(env, path, b.data || {}); return J({ ok: true }); }
    if (op === 'update') { const cur = await getDoc(env, path); if (!cur) return J({ error: 'invalid_argument' }, 400); await putDoc(env, path, merge(cur, b.data)); return J({ ok: true }); }
    if (op === 'delete') { await env.DB.prepare('DELETE FROM docs WHERE path = ?1').bind(path).run(); return J({ ok: true }); }
    return J({ error: 'bad_op' }, 400);
  }
  return J({ error: 'not_found' }, 404);
}
