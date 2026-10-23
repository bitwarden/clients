import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));

export const extensionPath = join(here, "..", "dist");
const HOST_NAME = "com.bitwarden.cloudfill";

export async function startPageServer() {
  const posts = [];
  const server = createHttpServer(async (req, res) => {
    if (req.method === "POST") {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }
      posts.push({ url: req.url, body });
      res.writeHead(200, { "content-type": "text/plain" }).end("received");
      return;
    }
    const name = req.url.split("?")[0].replace(/^\//, "");
    if (!/^[a-z-]+\.html$/.test(name)) {
      res.writeHead(404).end();
      return;
    }
    res
      .writeHead(200, { "content-type": "text/html" })
      .end(await readFile(join(here, "pages", name)));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { port: server.address().port, posts, close: () => server.close() };
}

/** Local socket the native host connects to. Plays the role of the agent harness. */
export async function startNativeBridge() {
  let hostSocket;
  let nextId = 1;
  const pending = new Map();
  let connected;
  const hostConnected = new Promise((resolve) => (connected = resolve));

  const server = createTcpServer((socket) => {
    hostSocket = socket;
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line) {
          const reply = JSON.parse(line);
          pending.get(reply.id)?.(reply.result);
          pending.delete(reply.id);
        }
      }
    });
    connected();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    port: server.address().port,
    hostConnected,
    request: async (message, timeoutMs = 150_000) => {
      await hostConnected;
      const id = nextId++;
      const result = new Promise((resolve, reject) => {
        pending.set(id, resolve);
        setTimeout(() => reject(new Error(`native request ${message.type} timed out`)), timeoutMs);
      });
      hostSocket.write(JSON.stringify({ id, ...message }) + "\n");
      return result;
    },
    close: () => {
      hostSocket?.destroy();
      server.close();
    },
  };
}

async function installNativeHost(userDataDir, extensionId) {
  const dir = join(userDataDir, "NativeMessagingHosts");
  await mkdir(dir, { recursive: true });
  const wrapper = join(userDataDir, "cloud-fill-host.sh");
  await writeFile(
    wrapper,
    `#!/bin/sh\nexec "${process.execPath}" "${join(here, "native-host.mjs")}"\n`,
  );
  await chmod(wrapper, 0o755);
  await writeFile(
    join(dir, `${HOST_NAME}.json`),
    JSON.stringify({
      name: HOST_NAME,
      description: "Cloud fill test harness bridge",
      path: wrapper,
      type: "stdio",
      allowed_origins: [`chrome-extension://${extensionId}/`],
    }),
  );
}

export async function launchWithExtension({ bridge } = {}) {
  const userDataDir = await mkdtemp(join(tmpdir(), "cloud-fill-profile-"));
  const env = { ...process.env };
  if (bridge) {
    env.CLOUD_FILL_BRIDGE_PORT = String(bridge.port);
  }
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    env,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).hostname;
  if (bridge) {
    await installNativeHost(userDataDir, extensionId);
  }
  return {
    context,
    worker,
    extensionId,
    close: async () => {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}

export async function trigger(worker, page) {
  await page.bringToFront();
  return worker.evaluate(() => globalThis.cloudFill.fillActiveTab());
}
