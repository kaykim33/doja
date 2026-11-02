// 도자의 숲 실시간 방: 같이 있는 사람의 위치·닉네임·말을 주고받아요 (WebSocket + Durable Object)
import { DurableObject } from 'cloudflare:workers';

const MAX_PEERS = 40, MAX_BYTES = 6000;

export class Room extends DurableObject {
  peers() { return this.ctx.getWebSockets().map(ws => ws.deserializeAttachment() || {}).filter(a => a.peer); }
  send(ws, m) { try { ws.send(JSON.stringify(m)); } catch (e) {} }
  bcast(m, except) { const s = JSON.stringify(m); for (const ws of this.ctx.getWebSockets()) { if (ws === except) continue; try { ws.send(s); } catch (e) {} } }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_PEERS) return new Response('full', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    const peer = 'p' + crypto.randomUUID().slice(0, 8);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer, presence: null });
    this.send(server, { t: 'hello', peer, peers: this.peers().filter(a => a.presence) });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > MAX_BYTES) return;
    let m; try { m = JSON.parse(msg); } catch (e) { return; }
    const a = ws.deserializeAttachment() || {};
    if (m.t === 'p' && m.p && typeof m.p === 'object') {
      a.presence = m.p; ws.serializeAttachment(a);
      this.bcast({ t: 'p', peer: a.peer, presence: m.p }, ws);
    } else if (m.t === 'ping') this.send(ws, { t: 'pong' });
  }
  async webSocketClose(ws) { const a = ws.deserializeAttachment() || {}; if (a.peer) this.bcast({ t: 'bye', peer: a.peer }, ws); try { ws.close(1000); } catch (e) {} }
  async webSocketError(ws) { return this.webSocketClose(ws); }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.endsWith('/api/room') || url.pathname === '/') return env.ROOM.get(env.ROOM.idFromName('main')).fetch(req);
    return new Response('not found', { status: 404 });
  }
};
