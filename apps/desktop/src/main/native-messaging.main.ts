// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { existsSync, promises as fs } from "fs";
import { homedir, userInfo } from "os";
import * as path from "path";

import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ipc, windows_registry } from "@bitwarden/desktop-napi";

import { isDev } from "../utils";

import { WindowMain } from "./window.main";

export class NativeMessagingMain {
  private ipcServer: ipc.IpcServer | null;
  private connected: number[] = [];

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
    private userPath: string,
    private exePath: string,
    private appPath: string,
  ) {
    ipcMain.handle(
      "nativeMessaging.manifests",
      async (_event: any, options: { create: boolean }) => {
        if (options.create) {
          try {
            await this.listen();
            await this.generateManifests();
          } catch (e) {
            this.logService.error("Error generating manifests: " + e);
            return e;
          }
        } else {
          this.stop();
          try {
            await this.removeManifests();
          } catch (e) {
            this.logService.error("Error removing manifests: " + e);
            return e;
          }
        }
        return null;
      },
    );

    ipcMain.handle(
      "nativeMessaging.ddgManifests",
      async (_event: any, options: { create: boolean }) => {
        if (options.create) {
          try {
            await this.listen();
            await this.generateDdgManifests();
          } catch (e) {
            this.logService.error("Error generating duckduckgo manifests: " + e);
            return e;
          }
        } else {
          this.stop();
          try {
            await this.removeDdgManifests();
          } catch (e) {
            this.logService.error("Error removing duckduckgo manifests: " + e);
            return e;
          }
        }
        return null;
      },
    );
  }

  async listen() {
    if (this.ipcServer) {
      this.ipcServer.stop();
    }

    this.ipcServer = await ipc.IpcServer.listen("bitwarden", (error, msg) => {
      switch (msg.kind) {
        case ipc.IpcMessageType.Connected: {
          this.connected.push(msg.clientId);
          this.logService.info("Native messaging client " + msg.clientId + " has connected");
          break;
        }
        case ipc.IpcMessageType.Disconnected: {
          const index = this.connected.indexOf(msg.clientId);
          if (index > -1) {
            this.connected.splice(index, 1);
          }

          this.logService.info("Native messaging client " + msg.clientId + " has disconnected");
          break;
        }
        case ipc.IpcMessageType.Message:
          try {
            const msgJson = JSON.parse(msg.message);
            this.logService.debug("Native messaging message:", msgJson);
            this.windowMain.win?.webContents.send("nativeMessaging", msgJson);
          } catch (e) {
            this.logService.warning("Error processing message:", e, msg.message);
          }
          break;

        default:
          this.logService.warning("Unknown message type:", msg.kind, msg.message);
          break;
      }
    });

    for (const path of this.ipcServer.getPaths()) {
      this.logService.info("Native messaging server started at:", path);
    }

    ipcMain.on("nativeMessagingReply", (event, msg) => {
      if (msg != null) {
        this.send(msg);
      }
    });
  }

  stop() {
    this.ipcServer?.stop();
  }

  send(message: object) {
    this.logService.debug("Native messaging reply:", message);
    this.ipcServer?.send(JSON.stringify(message));
  }

  private async generateChromeJson(binaryPath: string) {
    return {
      name: "com.8bit.bitwarden",
      description: "Bitwarden desktop <-> browser bridge",
      path: binaryPath,
      type: "stdio",
      allowed_origins: await this.loadChromeIds(),
    };
  }

  private async generateFirefoxJson(binaryPath: string) {
    return {
      name: "com.8bit.bitwarden",
      description: "Bitwarden desktop <-> browser bridge",
      path: binaryPath,
      type: "stdio",
      allowed_extensions: ["{446900e4-71c2-419f-a6a7-df9c091e268b}"],
    };
  }

  async generateManifests() {
    const binaryPath = this.binaryPath();
    if (!existsSync(binaryPath)) {
      throw new Error(`Unable to find proxy binary: ${binaryPath}`);
    }

    switch (process.platform) {
      case "win32": {
        const destination = path.join(this.userPath, "browsers");
        await this.writeManifest(
          path.join(destination, "firefox.json"),
          await this.generateFirefoxJson(binaryPath),
        );
        await this.writeManifest(
          path.join(destination, "chrome.json"),
          await this.generateChromeJson(binaryPath),
        );

        const nmhs = this.getWindowsNMHS();
        for (const [name, [key, subkey]] of Object.entries(nmhs)) {
          let manifestPath = path.join(destination, "chrome.json");
          if (name === "Firefox") {
            manifestPath = path.join(destination, "firefox.json");
          }
          await windows_registry.createKey(key, subkey, manifestPath);
        }
        break;
      }
      case "darwin": {
        const nmhs = this.getDarwinNMHS();
        for (const [key, value] of Object.entries(nmhs)) {
          if (existsSync(value)) {
            const p = path.join(value, "NativeMessagingHosts", "com.8bit.bitwarden.json");

            let manifest: any = await this.generateChromeJson(binaryPath);
            if (key === "Firefox" || key === "Zen") {
              manifest = await this.generateFirefoxJson(binaryPath);
            }

            await this.writeManifest(p, manifest);
          } else {
            this.logService.warning(`${key} not found, skipping.`);
          }
        }
        break;
      }
      case "linux": {
        // Because on linux, th path inside the sandbox is different, and we want to support:
        // Flatpak App, Unsandboxed App, Flatpak Browser, Unsandboxed Browser, Snap App, Unsandboxed App
        // and any combination of the above, we copy the binary to the applications native-messaging-hosts path
        // so that a canonical path to put in the manifest can be used.

        // Unsandboxed browser
        for (const [key, value] of Object.entries(this.getLinuxNMHS())) {
          if (existsSync(value)) {
            let nhmsPath = path.join(value, "NativeMessagingHosts");
            if (key === "Firefox") {
              nhmsPath = path.join(value, "native-messaging-hosts");
            }
            const browserBinaryPath = path.join(nhmsPath, ".bitwarden_desktop_proxy");

            await fs.mkdir(nhmsPath, { recursive: true });
            await this.linkOrCopy(binaryPath, browserBinaryPath);
            this.logService.info(
              `[Native messaging] Hard-linked ${binaryPath} to ${browserBinaryPath}`,
            );

            if (key === "Firefox") {
              await this.writeManifest(
                path.join(nhmsPath, "com.8bit.bitwarden.json"),
                await this.generateFirefoxJson(browserBinaryPath),
              );
            } else {
              await this.writeManifest(
                path.join(nhmsPath, "com.8bit.bitwarden.json"),
                await this.generateChromeJson(browserBinaryPath),
              );
            }
          } else {
            this.logService.warning(`${key} not found, skipping.`);
          }
        }

        for (const [key, value] of Object.entries(this.getFlatpakNMHS())) {
          if (existsSync(value)) {
            const sandboxedProxyBinaryPath = path.join(value, ".bitwarden_desktop_proxy");
            await this.linkOrCopy(binaryPath, sandboxedProxyBinaryPath);
            this.logService.info(
              `[Native messaging] Hard-linked ${binaryPath} to ${sandboxedProxyBinaryPath}`,
            );

            if (key === "Firefox") {
              await this.writeManifest(
                path.join(value, "com.8bit.bitwarden.json"),
                await this.generateFirefoxJson(sandboxedProxyBinaryPath),
              );
            } else if (key === "Chrome" || key === "Chromium" || key === "Microsoft Edge") {
              await this.writeManifest(
                path.join(value, "com.8bit.bitwarden.json"),
                await this.generateChromeJson(sandboxedProxyBinaryPath),
              );
            } else {
              this.logService.warning(`Flatpak ${key} not supported, skipping.`);
            }
          } else {
            this.logService.warning(`${key} not found, skipping.`);
          }
        }

        break;
      }
      default:
        break;
    }
  }

  async generateDdgManifests() {
    const manifest = {
      name: "com.8bit.bitwarden",
      description: "Bitwarden desktop <-> DuckDuckGo bridge",
      path: this.binaryPath(),
      type: "stdio",
    };

    if (!existsSync(manifest.path)) {
      throw new Error(`Unable to find binary: ${manifest.path}`);
    }

    switch (process.platform) {
      case "darwin": {
        /* eslint-disable-next-line no-useless-escape */
        const path = `${this.homedir()}/Library/Containers/com.duckduckgo.macos.browser/Data/Library/Application\ Support/NativeMessagingHosts/com.8bit.bitwarden.json`;
        await this.writeManifest(path, manifest);
        break;
      }
      default:
        break;
    }
  }

  async removeManifests() {
    switch (process.platform) {
      case "win32": {
        await this.removeIfExists(path.join(this.userPath, "browsers", "firefox.json"));
        await this.removeIfExists(path.join(this.userPath, "browsers", "chrome.json"));

        const nmhs = this.getWindowsNMHS();
        for (const [, [key, subkey]] of Object.entries(nmhs)) {
          await windows_registry.deleteKey(key, subkey);
        }
        break;
      }
      case "darwin": {
        const nmhs = this.getDarwinNMHS();
        for (const [, value] of Object.entries(nmhs)) {
          await this.removeIfExists(
            path.join(value, "NativeMessagingHosts", "com.8bit.bitwarden.json"),
          );
        }
        break;
      }
      case "linux": {
        for (const [key, value] of Object.entries(this.getLinuxNMHS())) {
          if (key === "Firefox") {
            await this.removeIfExists(
              path.join(value, "native-messaging-hosts", "com.8bit.bitwarden.json"),
            );
          } else {
            await this.removeIfExists(
              path.join(value, "NativeMessagingHosts", "com.8bit.bitwarden.json"),
            );
          }
        }

        for (const [, value] of Object.entries(this.getFlatpakNMHS())) {
          await this.removeIfExists(path.join(value, "com.8bit.bitwarden.json"));
          await this.removeIfExists(path.join(value, "bitwarden_desktop_proxy"));
        }

        break;
      }
      default:
        break;
    }
  }

  async removeDdgManifests() {
    switch (process.platform) {
      case "darwin": {
        /* eslint-disable-next-line no-useless-escape */
        const path = `${this.homedir()}/Library/Containers/com.duckduckgo.macos.browser/Data/Library/Application\ Support/NativeMessagingHosts/com.8bit.bitwarden.json`;
        await this.removeIfExists(path);
        break;
      }
      default:
        break;
    }
  }

  private getWindowsNMHS() {
    return {
      Firefox: ["HKCU", "SOFTWARE\\Mozilla\\NativeMessagingHosts\\com.8bit.bitwarden"],
      Chrome: ["HKCU", "SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.8bit.bitwarden"],
      Chromium: ["HKCU", "SOFTWARE\\Chromium\\NativeMessagingHosts\\com.8bit.bitwarden"],
      // Edge uses the same registry key as Chrome as a fallback, but it's has its own separate key as well.
      "Microsoft Edge": [
        "HKCU",
        "SOFTWARE\\Microsoft\\Edge\\NativeMessagingHosts\\com.8bit.bitwarden",
      ],
    };
  }

  private getDarwinNMHS() {
    /* eslint-disable no-useless-escape */
    return {
      Firefox: `${this.homedir()}/Library/Application\ Support/Mozilla/`,
      Chrome: `${this.homedir()}/Library/Application\ Support/Google/Chrome/`,
      "Chrome Beta": `${this.homedir()}/Library/Application\ Support/Google/Chrome\ Beta/`,
      "Chrome Dev": `${this.homedir()}/Library/Application\ Support/Google/Chrome\ Dev/`,
      "Chrome Canary": `${this.homedir()}/Library/Application\ Support/Google/Chrome\ Canary/`,
      Chromium: `${this.homedir()}/Library/Application\ Support/Chromium/`,
      "Microsoft Edge": `${this.homedir()}/Library/Application\ Support/Microsoft\ Edge/`,
      "Microsoft Edge Beta": `${this.homedir()}/Library/Application\ Support/Microsoft\ Edge\ Beta/`,
      "Microsoft Edge Dev": `${this.homedir()}/Library/Application\ Support/Microsoft\ Edge\ Dev/`,
      "Microsoft Edge Canary": `${this.homedir()}/Library/Application\ Support/Microsoft\ Edge\ Canary/`,
      Vivaldi: `${this.homedir()}/Library/Application\ Support/Vivaldi/`,
      Zen: `${this.homedir()}/Library/Application\ Support/Zen/`,
    };
    /* eslint-enable no-useless-escape */
  }

  private getLinuxNMHS() {
    return {
      Firefox: `${this.homedir()}/.mozilla/`,
      Chrome: `${this.homedir()}/.config/google-chrome/`,
      Chromium: `${this.homedir()}/.config/chromium/`,
      "Microsoft Edge": `${this.homedir()}/.config/microsoft-edge/`,
    };
  }

  private getFlatpakNMHS() {
    return {
      Firefox: `${this.homedir()}/.var/app/org.mozilla.firefox/.mozilla/native-messaging-hosts/`,
      Chrome: `${this.homedir()}/.var/app/com.google.Chrome/config/google-chrome/NativeMessagingHosts/`,
      Chromium: `${this.homedir()}/.var/app/org.chromium.Chromium/config/chromium/NativeMessagingHosts/`,
      "Microsoft Edge": `${this.homedir()}/.var/app/com.microsoft.Edge/config/microsoft-edge/NativeMessagingHosts/`,
    };
  }

  private async writeManifest(destination: string, manifest: object) {
    this.logService.debug(`Writing manifest: ${destination}`);

    if (!existsSync(path.dirname(destination))) {
      await fs.mkdir(path.dirname(destination));
    }

    await fs.writeFile(destination, JSON.stringify(manifest, null, 2));
  }

  private async loadChromeIds(): Promise<string[]> {
    const ids: Set<string> = new Set([
      // Chrome extension
      "chrome-extension://nngceckbapebfimnlniiiahkandclblb/",
      // Chrome beta extension
      "chrome-extension://hccnnhgbibccigepcmlgppchkpfdophk/",
      // Edge extension
      "chrome-extension://jbkfoedolllekgbhcbcoahefnbanhhlh/",
      // Opera extension
      "chrome-extension://ccnckbpmaceehanjmeomladnmlffdjgn/",
    ]);

    if (!isDev()) {
      return Array.from(ids);
    }

    // The dev builds of the extension have a different random ID per user, so to make development easier
    // we try to find the extension IDs from the user's Chrome profiles when we're running in dev mode.
    let chromePaths: string[];
    switch (process.platform) {
      case "darwin": {
        chromePaths = Object.entries(this.getDarwinNMHS())
          .filter(([key]) => key !== "Firefox")
          .map(([, value]) => value);
        break;
      }
      case "linux": {
        chromePaths = Object.entries(this.getLinuxNMHS())
          .filter(([key]) => key !== "Firefox")
          .map(([, value]) => value);
        break;
      }
      case "win32": {
        // TODO: Add more supported browsers for Windows?
        chromePaths = [
          path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data"),
          path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "User Data"),
        ];
        break;
      }
    }

    for (const chromePath of chromePaths) {
      try {
        // The chrome profile directories are named "Default", "Profile 1", "Profile 2", etc.
        const profiles = (await fs.readdir(chromePath)).filter((f) => {
          const lower = f.toLowerCase();
          return lower == "default" || lower.startsWith("profile ");
        });

        for (const profile of profiles) {
          try {
            // Read the profile Preferences file and find the extension commands section
            const prefs = JSON.parse(
              await fs.readFile(path.join(chromePath, profile, "Preferences"), "utf8"),
            );
            const commands: Map<string, any> = prefs.extensions.commands;

            // If one of the commands is autofill_login or generate_password, we know it's probably the Bitwarden extension
            for (const { command_name, extension } of Object.values(commands)) {
              if (command_name === "autofill_login" || command_name === "generate_password") {
                ids.add(`chrome-extension://${extension}/`);
                this.logService.info(`Found extension from ${chromePath}: ${extension}`);
              }
            }
          } catch (e) {
            this.logService.info(`Error reading preferences: ${e}`);
          }
        }
        // FIXME: Remove when updating file. Eslint update
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // Browser is not installed, we can just skip it
      }
    }

    return Array.from(ids);
  }

  private binaryPath() {
    const ext = process.platform === "win32" ? ".exe" : "";

    if (isDev()) {
      const devPath = path.join(
        this.appPath,
        "..",
        "desktop_native",
        "target",
        "debug",
        `desktop_proxy${ext}`,
      );

      // isDev() returns true when using a production build with ELECTRON_IS_DEV=1,
      // so we need to fall back to the prod binary if the dev binary doesn't exist.
      if (existsSync(devPath)) {
        return devPath;
      }
    }

    return path.join(path.dirname(this.exePath), `desktop_proxy${ext}`);
  }

  private homedir() {
    if (process.platform === "darwin") {
      return userInfo().homedir;
    } else if (process.env.SNAP) {
      // Snap mounts a different user directory, making it impossible to access the unsandboxed paths of native messaging hosts under that dir.
      const username = userInfo().username;
      return path.join("/home", username);
    } else {
      return homedir();
    }
  }

  private async removeIfExists(path: string) {
    if (existsSync(path)) {
      await fs.unlink(path);
    }
  }

  private async linkOrCopy(source: string, destination: string) {
    try {
      if (existsSync(destination)) {
        await fs.unlink(destination);
      }
      await fs.link(source, destination);
      this.logService.info(`[Native messaging] Hard-linked ${source} to ${destination}`);
    } catch (e) {
      this.logService.warning(
        `[Native messaging] Failed to hard-link ${source} to ${destination}, copying instead: ${e}`,
      );
      await fs.copyFile(source, destination);
      this.logService.info(`[Native messaging] Copied ${source} to ${destination}`);
    }
  }
}
