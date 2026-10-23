import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { launchWithExtension, startPageServer } from "./harness.mjs";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const hostDir = join(here, "..", "host");

const pages = await startPageServer();
const browser = await launchWithExtension();
const home = await mkdtemp(join(tmpdir(), "cloud-fill-home-"));
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

async function ctl(...args) {
  const env = { ...process.env, CLOUD_FILL_HOME: home };
  try {
    const { stdout } = await run(process.execPath, [join(hostDir, "cloud-fill.mjs"), ...args], {
      env,
    });
    return JSON.parse(stdout);
  } catch (error) {
    return JSON.parse(error.stdout);
  }
}

async function waitForHost() {
  for (let attempt = 0; attempt < 30; attempt++) {
    if ((await ctl("fill")).status !== "no_host") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const { stdout } = await run("sh", ["-c", `ls -la ${home}; ps aux | grep cloud-fill-host | grep -v grep | wc -l`]);
  throw new Error("host never came up " + stdout);
}

try {
  await check("trigger reports no_host before the host is installed", async () => {
    assert.equal((await ctl("fill")).status, "no_host");
  });

  await run(process.execPath, [
    join(hostDir, "install.mjs"),
    "--extension-id",
    browser.extensionId,
    "--manifest-dir",
    join(browser.userDataDir, "NativeMessagingHosts"),
    "--home",
    home,
  ]);

  const page = await browser.context.newPage();
  await page.goto(`http://localhost:${pages.port}/login.html`);
  await page.bringToFront();

  await check("host socket is private to the user", async () => {
    await waitForHost();
    assert.equal((await stat(join(home, "host.sock"))).mode & 0o077, 0);
    assert.equal((await stat(home)).mode & 0o077, 0);
  });

  await check("fill through the host reaches the extension (not paired yet)", async () => {
    assert.equal((await ctl("fill")).status, "not_paired");
  });

  await check("a pinned origin that does not match the tab is refused", async () => {
    assert.equal((await ctl("fill", "--origin", "http://localhost:1")).status, "refused_origin");
  });

  await check("a malformed pairing token is rejected", async () => {
    assert.equal((await ctl("pair", "not-a-token")).status, "relay_error");
  });

  await check("unknown request types are not forwarded", async () => {
    const { connect } = await import("node:net");
    const reply = await new Promise((resolve) => {
      const socket = connect(join(home, "host.sock"));
      let data = "";
      socket.on("connect", () => socket.write(JSON.stringify({ type: "exec" }) + "\n"));
      socket.on("data", (chunk) => (data += chunk));
      socket.on("close", () => resolve(JSON.parse(data)));
    });
    assert.equal(reply.status, "error");
  });
} finally {
  await browser.close();
  pages.close();
  await rm(home, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
