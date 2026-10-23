// Native messaging host for the Cloud Fill extension. Chrome launches it; it relays requests from
// the local socket to the extension and replies back. Requests carry no credential data and
// neither do replies. stdout is reserved for the native messaging protocol.
import { chmodSync, mkdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

const home = process.env.CLOUD_FILL_HOME ?? join(homedir(), ".cloud-fill");
mkdirSync(home, { recursive: true, mode: 0o700 });
chmodSync(home, 0o700);
const socketPath = join(home, "host.sock");

const pending = new Map();
let nextId = 1;

function sendToExtension(message) {
  const body = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}

let stdinBuffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
  while (stdinBuffer.length >= 4) {
    const length = stdinBuffer.readUInt32LE(0);
    if (stdinBuffer.length < 4 + length) {
      return;
    }
    const reply = JSON.parse(stdinBuffer.subarray(4, 4 + length).toString("utf8"));
    stdinBuffer = stdinBuffer.subarray(4 + length);
    const client = pending.get(reply.id);
    pending.delete(reply.id);
    client?.end(JSON.stringify(reply.result) + "\n");
  }
});
process.stdin.on("end", () => {
  rmSync(socketPath, { force: true });
  process.exit(0);
});

const ALLOWED = new Set(["fill", "pair"]);

const server = createServer((client) => {
  let buffer = "";
  client.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const newline = buffer.indexOf("\n");
    if (newline < 0) {
      return;
    }
    let request;
    try {
      request = JSON.parse(buffer.slice(0, newline));
    } catch {
      client.end(JSON.stringify({ status: "error" }) + "\n");
      return;
    }
    if (!ALLOWED.has(request?.type)) {
      client.end(JSON.stringify({ status: "error" }) + "\n");
      return;
    }
    const id = nextId++;
    pending.set(id, client);
    client.on("close", () => pending.delete(id));
    sendToExtension({ ...request, id });
  });
  client.on("error", () => {});
});

rmSync(socketPath, { force: true });
server.listen(socketPath, () => chmodSync(socketPath, 0o600));
