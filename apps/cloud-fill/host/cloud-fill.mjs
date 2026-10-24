#!/usr/bin/env node
// Command line trigger for the Cloud Fill extension, through the native messaging host.
//   cloud-fill fill [--origin https://example.com]
//   cloud-fill pair <psk-token | -> [--replace]
// Prints the status JSON. Exit code is 0 only for status "ok".
import { connect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

const home = process.env.CLOUD_FILL_HOME ?? join(homedir(), ".cloud-fill");
const args = process.argv.slice(2);
const command = args.shift();

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.trim();
}

function flag(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

let request;
if (command === "fill") {
  request = { type: "fill" };
  const origin = flag("--origin");
  if (origin) {
    request.expectedOrigin = origin;
  }
} else if (command === "pair") {
  const token = args[0] === "-" ? await readStdin() : args[0];
  if (!token) {
    console.error("usage: cloud-fill pair <psk-token | -> [--replace]");
    process.exit(2);
  }
  request = { type: "pair", pskToken: token, replace: args.includes("--replace") };
} else {
  console.error("usage: cloud-fill fill [--origin <origin>] | pair <psk-token | -> [--replace]");
  process.exit(2);
}

const socket = connect(join(home, "host.sock"));
let reply = "";
socket.on("connect", () => socket.write(JSON.stringify(request) + "\n"));
socket.on("data", (chunk) => (reply += chunk));
socket.on("error", () => {
  console.log(JSON.stringify({ status: "no_host" }));
  process.exit(1);
});
socket.on("close", () => {
  console.log(reply.trim() || JSON.stringify({ status: "error" }));
  let status;
  try {
    status = JSON.parse(reply).status;
  } catch {}
  process.exit(status === "ok" ? 0 : 1);
});
