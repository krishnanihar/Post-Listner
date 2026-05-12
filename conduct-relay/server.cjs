const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const os = require('node:os');
const { WebSocketServer, WebSocket } = require('ws');
const selfsigned = require('selfsigned');

const PORT = 8443;
const ROOT = __dirname;
const CERT_DIR = path.join(ROOT, 'certs');
const PUBLIC_DIR = path.join(ROOT, 'public');

function getLocalIPs() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

function loadOrCreateCerts() {
  const keyPath = path.join(CERT_DIR, 'key.pem');
  const certPath = path.join(CERT_DIR, 'cert.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }
  fs.mkdirSync(CERT_DIR, { recursive: true });
  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...getLocalIPs().map((ip) => ({ type: 7, ip })),
  ];
  const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames }],
  });
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  console.log('[certs] generated self-signed cert in ./certs');
  return { key: pems.private, cert: pems.cert };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const ROUTES = {
  '/': '/desktop.html',
  '/phone': '/phone.html',
  '/desktop': '/desktop.html',
};

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const mapped = ROUTES[urlPath] || urlPath;
  const filePath = path.join(PUBLIC_DIR, mapped);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const { key, cert } = loadOrCreateCerts();
const server = https.createServer({ key, cert }, serveStatic);
const wss = new WebSocketServer({ server });

const desktops = new Set();
const phones = new Set();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const role = url.searchParams.get('role');
  if (role === 'desktop') {
    desktops.add(ws);
    console.log(`[ws] desktop connected (${desktops.size} total)`);
    ws.on('close', () => {
      desktops.delete(ws);
      console.log(`[ws] desktop disconnected (${desktops.size} total)`);
    });
  } else if (role === 'phone') {
    phones.add(ws);
    let msgCount = 0;
    let relayCount = 0;
    console.log(`[ws] phone connected (${phones.size} total)`);
    ws.on('message', (data, isBinary) => {
      msgCount++;
      let sent = 0;
      for (const d of desktops) {
        if (d.readyState === WebSocket.OPEN) {
          d.send(data, { binary: isBinary });
          sent++;
        }
      }
      relayCount += sent;
      if (msgCount === 1 || msgCount % 60 === 0) {
        console.log(`[ws] phone msg #${msgCount} → ${sent} desktops (cumulative relayed: ${relayCount})`);
      }
    });
    ws.on('close', () => {
      phones.delete(ws);
      console.log(`[ws] phone disconnected (${phones.size} total, sent ${msgCount} msgs)`);
    });
  } else {
    ws.close();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  const line = '─'.repeat(60);
  console.log(line);
  console.log('Conducting app server running.');
  console.log('Accept the self-signed cert warning the first time on each device.');
  console.log('');
  console.log(`  Desktop:  https://localhost:${PORT}/desktop`);
  if (ips.length === 0) {
    console.log('  Phone:    (no LAN IP found — connect to a network)');
  } else {
    for (const ip of ips) {
      console.log(`  Phone:    https://${ip}:${PORT}/phone`);
    }
  }
  console.log(line);
});
