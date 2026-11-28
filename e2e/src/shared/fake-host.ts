import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, Server, Socket } from "node:net";

import { BrowserContext } from "@playwright/test";

import { FAKE_NATIVE_HOST, PROXY_CONTROL_SOCKET } from "../paths";

import { HOST_MANIFEST, test as desktopTest } from "./desktop-fixtures";

const EXTENSION_SCHEME = "chrome-extension://";

/**
 * How the fake native messaging host treats frames on their way to the extension.
 * See src/shared/fake-native-host.mjs.
 */
export const HostMode = Object.freeze({
  /** Relay both directions, like the real proxy. */
  Pass: "pass",
  /** Relay to the desktop app, deliver nothing back. */
  Silence: "silence",
});
export type HostMode = (typeof HostMode)[keyof typeof HostMode];

/** Holds back only the frame reporting the connection, by `ms`. */
export function slowConnect(ms: number): string {
  return `slow-connect ${ms}`;
}

/**
 * The control socket the fake hosts connect back to.
 *
 * The test listens and the hosts connect, not the other way around: every extension restart
 * spawns another host, and they would race to bind one path. Each new host is sent the current
 * mode as its first line, so it starts out in whatever the test last asked for.
 */
export class HostControl {
  private readonly hosts = new Set<Socket>();
  private mode: string = HostMode.Pass;

  private constructor(private readonly server: Server) {}

  static async listen(): Promise<HostControl> {
    // A socket file outlives the process that made it.
    rmSync(PROXY_CONTROL_SOCKET, { force: true });

    const server = createServer();
    const control = new HostControl(server);

    server.on("connection", (host) => {
      control.hosts.add(host);
      host.on("close", () => control.hosts.delete(host));
      host.on("error", () => control.hosts.delete(host));
      host.write(`${control.mode}\n`);
    });

    await new Promise<void>((resolve) => server.listen(PROXY_CONTROL_SOCKET, resolve));
    return control;
  }

  /** Points the host manifest at the fake host. Chromium re-reads the manifest on every connect. */
  useFakeHost() {
    const manifest = JSON.parse(readFileSync(HOST_MANIFEST, "utf8"));
    writeFileSync(HOST_MANIFEST, JSON.stringify({ ...manifest, path: FAKE_NATIVE_HOST }, null, 2));
  }

  /** Changes what every connected host does next, and what the next host to start does first. */
  setMode(mode: HostMode | string) {
    this.mode = mode;

    for (const host of this.hosts) {
      host.write(`${mode}\n`);
    }
  }

  async close() {
    for (const host of this.hosts) {
      host.destroy();
    }

    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    rmSync(PROXY_CONTROL_SOCKET, { force: true });
  }
}

/**
 * Whether background startup finished, from `MainBackground.initializationCompleted`.
 *
 * Read off the service worker rather than through the automation driver: the driver is attached
 * by the popup (`popup/services/init.service.ts`), and it is the background this asks about.
 */
export async function bootstrapCompleted(context: BrowserContext): Promise<boolean> {
  const worker = context.serviceWorkers().find((w) => w.url().startsWith(EXTENSION_SCHEME));

  return (
    (await worker
      ?.evaluate(() => (globalThis as any).bitwardenMain?.initializationCompleted === true)
      .catch(() => false)) ?? false
  );
}

/** The extension beside the desktop app, with the fake native messaging host under test control. */
export const test = desktopTest.extend<{ hostControl: HostControl }>({
  hostControl: async ({}, use) => {
    const control = await HostControl.listen();
    await use(control);
    await control.close();
  },
});

export { expect } from "@playwright/test";
