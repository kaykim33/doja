// 실시간 방으로 연결 (Pages 설정 → 바인딩 → Durable Object: ROOM → doja-room 의 Room)
export async function onRequest({ request, env }) {
  if (!env.ROOM) return new Response(JSON.stringify({ error: 'no_room' }), { status: 503, headers: { 'content-type': 'application/json' } });
  return env.ROOM.get(env.ROOM.idFromName('main')).fetch(request);
}
