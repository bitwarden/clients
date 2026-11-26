#!/usr/bin/env node
/**
 * A stand-in for `desktop_proxy`, the native messaging host Chromium spawns to reach the desktop
 * app. It relays the same two channels the real one does, and misbehaves on command:
 *
 *   extension ──stdio frames──▶ fake host ──unix socket──▶ desktop app
 *                                   │
 *                                   └──control socket──▶ the test
 *
 * The test listens on BW_E2E_PROXY_CONTROL and this connects to it, because each extension
 * restart spawns another host and they would otherwise race to bind one path. The test sends one
 * mode per line, the current one first:
 *
 *   pass                 relay both directions
 *   silence              relay to the desktop, deliver nothing back to the extension
 *   slow-connect <ms>    hold back only the frame reporting the connection
 *
 * `silence` is the failure the real proxy cannot be made to produce on demand: the port stays
 * open and the process stays alive, so Chromium never fires `onDisconnect`, and the extension
 * waits on a connection that never reports itself.
 *
 * stdout carries the protocol. Diagnostics go to stderr, never stdout.
 */
import { connect } from "node:net";
import { join } from "node:path";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

/**
 * Both channels frame messages as a 4-byte native-endian length followed by that many bytes.
 * Read and written here as little-endian, which is every platform the suite runs on.
 */
const LENGTH_BYTES = 4;

const CONTROL_ENV = "BW_E2E_PROXY_CONTROL";
const SOCKET_DIR_ENV = "BITWARDEN_IPC_SOCKET_DIR";
const SOCKET_NAME = "s.bw";

const Mode = Object.freeze({
  Pass: "pass",
  Silence: "silence",
  SlowConnect: "slow-connect",
});

/**
 * The two frames the proxy sends the extension itself rather than forwarding. The extension
 * treats `connected` as the signal that the desktop app is reachable.
 * See desktop_native/core/src/ipc/client.rs.
 */
const CONNECTED = Buffer.from(JSON.stringify({ command: "connected" }));
const DISCONNECTED = Buffer.from(JSON.stringify({ command: "disconnected" }));

const CHROME_ORIGIN_PREFIX = "chrome-extension://";

/**
 * The first frame the desktop app expects, naming the client that spawned this process. Chromium
 * passes the extension origin as the first argument.
 * See desktop_native/core/src/ipc/announcement.rs.
 */
function announcement(args) {
  const origin = args.find((arg) => arg.startsWith(CHROME_ORIGIN_PREFIX));
  if (origin == null) {
    return Buffer.from(JSON.stringify({ clientType: "unknown" }));
  }

  const extensionId = origin.slice(CHROME_ORIGIN_PREFIX.length).replace(/\/$/, "");
  return Buffer.from(JSON.stringify({ clientType: "chrome", extensionId }));
}

/**
 * Follows the mode the test publishes on the control socket.
 *
 * `ready` resolves on the first mode received, so nothing is relayed before the test's opening
 * instruction is in force. With no control socket to reach, the mode stays {@link Mode.Pass} and
 * `ready` resolves at once, leaving this a transparent relay.
 */
function followControl() {
  let mode = [Mode.Pass, undefined];
  let received;
  const ready = new Promise((resolve) => (received = resolve));

  const path = process.env[CONTROL_ENV];
  if (path == null) {
    received();
    return { current: () => mode, ready };
  }

  const control = connect(path);
  control.on("error", received);
  control.setEncoding("utf8");

  let pending = "";
  control.on("data", (chunk) => {
    pending += chunk;

    let newline;
    while ((newline = pending.indexOf("\n")) !== -1) {
      mode = pending.slice(0, newline).trim().split(/\s+/);
      pending = pending.slice(newline + 1);
      received();
    }
  });

  return { current: () => mode, ready };
}

/** Yields one payload per frame, reassembling frames split across chunks. */
async function* frames(stream) {
  let pending = Buffer.alloc(0);

  for await (const chunk of stream) {
    pending = Buffer.concat([pending, chunk]);

    while (pending.length >= LENGTH_BYTES) {
      const end = LENGTH_BYTES + pending.readUInt32LE(0);
      if (pending.length < end) {
        break;
      }

      yield pending.subarray(LENGTH_BYTES, end);
      pending = pending.subarray(end);
    }
  }
}

function writeFrame(stream, payload) {
  const header = Buffer.alloc(LENGTH_BYTES);
  header.writeUInt32LE(payload.length);

  stream.write(header);
  stream.write(payload);
}

/** Sends one frame to the extension, unless the mode in force right now says to drop it. */
function toExtension(control, payload) {
  const [mode] = control.current();

  if (mode === Mode.Silence) {
    return;
  }

  writeFrame(process.stdout, payload);
}

/**
 * Holds back the connection report under {@link Mode.SlowConnect}.
 *
 * Only this frame: the transport's budget covers reporting the connection, and the handshake
 * that follows has a budget of its own that several delayed round trips would exhaust.
 */
async function waitOutSlowConnect(control) {
  const [mode, argument] = control.current();

  if (mode === Mode.SlowConnect) {
    await sleep(Number(argument));
  }
}

async function main() {
  const control = followControl();
  await control.ready;

  const socketPath = join(process.env[SOCKET_DIR_ENV], SOCKET_NAME);
  const desktop = connect(socketPath);
  await once(desktop, "connect");

  writeFrame(desktop, announcement(process.argv.slice(2)));
  await waitOutSlowConnect(control);
  toExtension(control, CONNECTED);

  // Extension to desktop is never altered, so it needs no framing of its own.
  process.stdin.pipe(desktop);

  for await (const frame of frames(desktop)) {
    toExtension(control, frame);
  }

  toExtension(control, DISCONNECTED);
}

main().catch((error) => {
  process.stderr.write(`fake-native-host: ${error.stack}\n`);
  process.exit(1);
});
