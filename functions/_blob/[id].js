// 사진: 새로 올린 건 R2(BLOBS)에서, 옮겨 온 건 /blob/<id>.jpg|png 정적 파일에서
export async function onRequest({ params, env, request }) {
  const id = String(params.id || '');
  if (!/^[0-9a-f]{32}$/.test(id)) return new Response('not found', { status: 404 });
  if (env.BLOBS) { const o = await env.BLOBS.get(id); if (o) return new Response(o.body, { headers: { 'content-type': (o.httpMetadata && o.httpMetadata.contentType) || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } }); }
  if (env.DB) { try { const r = await env.DB.prepare('SELECT type, data FROM blobs WHERE id = ?1').bind(id).first(); if (r) return new Response(new Uint8Array(r.data), { headers: { 'content-type': r.type || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } }); } catch (e) {} }
  for (const ext of ['jpg', 'png', 'webp']) { const r = await env.ASSETS.fetch(new URL(`/blob/${id}.${ext}`, request.url)); if (r.ok) return new Response(r.body, { headers: { 'content-type': ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } }); }
  return new Response('not found', { status: 404 });
}
