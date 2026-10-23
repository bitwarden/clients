// Native messaging host launched by Chrome for the cloud-fill extension. It stands in for the
// agent harness: it relays JSON lines from the harness's local socket to the extension and
// replies back. Never logs message bodies.
import { connect } from "node:net";

const socket = connect({ host: "127.0.0.1", port: Number(process.env.CLOUD_FILL_BRIDGE_PORT) });

function send(message) {
  const body = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}

let socketBuffer = "";
socket.on("data", (chunk) => {
  socketBuffer += chunk.toString("utf8");
  let newline;
  while ((newline = socketBuffer.indexOf("\n")) >= 0) {
    const line = socketBuffer.slice(0, newline);
    socketBuffer = socketBuffer.slice(newline + 1);
    if (line) {
      send(JSON.parse(line));
    }
  }
});
socket.on("close", () => process.exit(0));

let stdinBuffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
  while (stdinBuffer.length >= 4) {
    const length = stdinBuffer.readUInt32LE(0);
    if (stdinBuffer.length < 4 + length) {
      return;
    }
    const message = stdinBuffer.subarray(4, 4 + length).toString("utf8");
    stdinBuffer = stdinBuffer.subarray(4 + length);
    socket.write(message + "\n");
  }
});
process.stdin.on("end", () => process.exit(0));
