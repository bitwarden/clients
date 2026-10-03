// A local mTLS test endpoint for both HTTPS and WebSocket upgrades.
const { createServer } = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { WebSocketServer } = require("ws");

const directory = path.resolve(process.argv[2] ?? ".flatpak/mtls-fixtures");
const port = Number(process.argv[3] ?? 8443);
const server = createServer({
  key: fs.readFileSync(path.join(directory, "server.key")),
  cert: fs.readFileSync(path.join(directory, "server.crt")),
  ca: fs.readFileSync(path.join(directory, "ca.crt")),
  requestCert: true,
  rejectUnauthorized: true,
});
const sockets = new WebSocketServer({ noServer: true });

function fingerprint(request) {
  return (
    request.socket.getPeerCertificate()?.fingerprint256?.replaceAll(":", "").toLowerCase() ?? null
  );
}

server.on("request", (request, response) => {
  if (request.url === "/probe") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><title>mTLS probe</title><script>
      fetch('/api/config').then(r => r.json()).then(x => console.log('probe-fetch', JSON.stringify(x))).catch(e => console.error('probe-fetch-error', String(e)));
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/config');
      xhr.onload = () => console.log('probe-xhr', xhr.responseText);
      xhr.onerror = () => console.error('probe-xhr-error');
      xhr.send();
      const ws = new WebSocket('wss://localhost:${port}/notifications/hub');
      ws.onmessage = e => { console.log('probe-ws', e.data); ws.close(); };
      ws.onerror = () => console.error('probe-ws-error');
    </script>`);
    return;
  }
  const body = JSON.stringify({ path: request.url, clientFingerprint: fingerprint(request) });
  response.writeHead(200, { "content-type": "application/json" });
  response.end(body);
});

server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/notifications/hub") {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, (websocket) => {
    websocket.send(JSON.stringify({ clientFingerprint: fingerprint(request) }));
    websocket.on("message", (message) => websocket.send(message));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mTLS proxy ready at https://localhost:${port}`);
});
