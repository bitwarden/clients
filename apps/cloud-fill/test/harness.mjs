import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));

export const extensionPath = join(here, "..", "dist");

export async function startPageServer() {
  const posts = [];
  const server = createServer(async (req, res) => {
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

export async function launchWithExtension() {
  const userDataDir = await mkdtemp(join(tmpdir(), "cloud-fill-profile-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  return {
    context,
    worker,
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
