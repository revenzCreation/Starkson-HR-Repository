const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.SYNC_RELAY_PORT || 8787);
const SECRET = process.env.SYNC_RELAY_SECRET || '';
const STATE_FILE = process.env.SYNC_RELAY_STATE || path.join(__dirname, 'sync-relay-events.json');
const clients = new Set();

function readEvents() {
  try {
    const value = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function writeEvents(events) {
  const tempFile = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(events.slice(-1000), null, 2));
  fs.renameSync(tempFile, STATE_FILE);
}

function authorized(req) {
  return !SECRET || req.headers['x-sync-secret'] === SECRET;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(body));
}

function broadcast(event) {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  clients.forEach(client => {
    try { client.write(payload); } catch (error) { clients.delete(client); }
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy(new Error('Payload too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, clients: clients.size });
    return;
  }

  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'POST' && req.url === '/events') {
    if (!authorized(req)) {
      sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      return;
    }
    try {
      const event = JSON.parse(await readBody(req));
      if (!event.eventId || !event.type) {
        sendJson(res, 400, { ok: false, error: 'eventId and type are required' });
        return;
      }
      const events = readEvents();
      if (events.some(item => item.eventId === event.eventId)) {
        sendJson(res, 200, { ok: true, duplicate: true });
        return;
      }
      const stored = { ...event, receivedAt: new Date().toISOString() };
      events.push(stored);
      writeEvents(events);
      broadcast(stored);
      sendJson(res, 202, { ok: true, eventId: event.eventId });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`sync relay listening on http://127.0.0.1:${PORT}`);
});
