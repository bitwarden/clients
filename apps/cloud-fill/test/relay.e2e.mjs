// End to end against a real ap-relay and the rust-listener example (a UserClient that auto
// approves and serves a fixed credential). Paths to the binaries come from the environment:
//   AP_RELAY_BIN, AP_LISTENER_BIN
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

import { launchWithExtension, startNativeBridge, startPageServer } from "./harness.mjs";

const expected = { username: "user@example.com", password: "hunter2" };

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function startProcess(command, env) {
  const child = spawn(command, [], { env: { ...process.env, ...env }, stdio: "pipe" });
  const output = { stdout: "", stderr: "" };
  child.stdout.on("data", (d) => (output.stdout += d));
  child.stderr.on("data", (d) => (output.stderr += d));
  return { child, output };
}

async function waitFor(predicate, what, timeoutMs = 30_000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const relayPort = await freePort();
const relayUrl = `ws://127.0.0.1:${relayPort}`;
const relay = startProcess(process.env.AP_RELAY_BIN, { BIND_ADDR: `127.0.0.1:${relayPort}` });
await new Promise((resolve) => setTimeout(resolve, 1000));
const listener = startProcess(process.env.AP_LISTENER_BIN, { RELAY_URL: relayUrl });
await waitFor(() => /^[0-9a-f]{64}_[0-9a-f]{64}\s/m.test(listener.output.stdout), "PSK token");
const pskToken = listener.output.stdout.trim().split("\n")[0];

const pages = await startPageServer();
const bridge = await startNativeBridge();
const browser = await launchWithExtension({ bridge });
let failed = false;

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${name}\n  ${error.message}`);
  }
}

async function fill(page) {
  await page.bringToFront();
  return bridge.request({ type: "fill" });
}

try {
  const page = await browser.context.newPage();
  const loginUrl = `http://localhost:${pages.port}/login.html`;
  await page.goto(loginUrl);

  await check("native messaging host connects to the extension", async () => {
    await Promise.race([
      bridge.hostConnected,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("host never connected")), 20_000),
      ),
    ]);
  });

  await check("fill before pairing reports not_paired and fills nothing", async () => {
    const result = await fill(page);
    assert.deepEqual(result, { status: "not_paired" });
    assert.equal(await page.locator("#password").inputValue(), "");
  });

  await check("pairs by PSK over the relay", async () => {
    const result = await bridge.request({ type: "pair", pskToken, relayUrl });
    assert.deepEqual(result, { status: "ok" });
  });

  await check(
    "fill requests the credential for the top frame hostname and fills the form",
    async () => {
      const result = await fill(page);
      assert.deepEqual(result, { status: "ok", filledFields: 2 });
      assert.equal(await page.locator("#username").inputValue(), expected.username);
      assert.equal(await page.locator("#password").inputValue(), expected.password);
      assert.equal(pages.posts.length, 0, "fill must not submit the form");
      await waitFor(
        () => /Credential requested: .*localhost/.test(listener.output.stderr),
        "listener log",
      );
    },
  );

  await check(
    "a second fill reuses the cached session after a fresh relay connection",
    async () => {
      await page.goto(loginUrl);
      const result = await fill(page);
      assert.deepEqual(result, { status: "ok", filledFields: 2 });
      assert.equal(await page.locator("#password").inputValue(), expected.password);
    },
  );

  await check(
    "the hostname asked of the user client comes from the tab, not the caller",
    async () => {
      await page.goto(`http://127.0.0.1:${pages.port}/login.html`);
      const result = await fill(page);
      assert.equal(result.status, "ok");
      await waitFor(
        () => /Credential requested: .*127\.0\.0\.1/.test(listener.output.stderr),
        "listener log",
      );
    },
  );

  await check("no native reply contains the credential", async () => {
    await page.goto(loginUrl);
    const result = JSON.stringify(await fill(page));
    assert.ok(!result.includes(expected.password) && !result.includes(expected.username));
  });

  await check(
    "refuses a form whose action leaves the origin without prompting the user",
    async () => {
      const before = (listener.output.stderr.match(/Credential requested/g) ?? []).length;
      await page.goto(`http://localhost:${pages.port}/cross-origin-action.html`);
      const result = await fill(page);
      assert.equal(result.status, "refused_form_action");
      assert.equal(await page.locator("#password").inputValue(), "");
      const after = (listener.output.stderr.match(/Credential requested/g) ?? []).length;
      assert.equal(after, before, "the user is not prompted for a refused page");
    },
  );
} finally {
  await browser.close();
  bridge.close();
  pages.close();
  listener.child.kill();
  relay.child.kill();
}

process.exit(failed ? 1 : 0);
