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

const MANIFEST_APP_NAME = "com.8bit.bitwarden";
const MANIFEST_FILENAME = `${MANIFEST_APP_NAME}.json`;
const CHROME_MANIFEST_FILENAME = "chrome.json";
const FIREFOX_MANIFEST_FILENAME = "firefox.json";
const FIREFOX_EXTENSION_ID = "{446900e4-71c2-419f-a6a7-df9c091e268b}";

const PROXY_BINARY_NAME = ".bitwarden_desktop_proxy";
const DESKTOP_PROXY_EXECUTABLE = "desktop_proxy";

const NATIVE_MESSAGING_HOSTS_DIR = "NativeMessagingHosts";
const FIREFOX_LINUX_NMHS_DIR = "native-messaging-hosts";

const WINDOWS_BROWSERS_DIR = "browsers";
const WINDOWS_BROWSER_USER_DATA_DIR = "User Data";
const NMHS_REGISTRY_KEY_SUFFIX = `${NATIVE_MESSAGING_HOSTS_DIR}\\${MANIFEST_APP_NAME}`;

const DARWIN_APP_SUPPORT_PATH = "Library/Application Support";
const DUCKDUCKGO_MAC_NMHS_PATH = `Library/Containers/com.duckduckgo.macos.browser/Data/${DARWIN_APP_SUPPORT_PATH}/${NATIVE_MESSAGING_HOSTS_DIR}`;

const CHROME_PREFERENCES_FILENAME = "Preferences";

export class NativeMessagingMain {
  private ipcServer: ipc.NativeIpcServer | null;
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

    this.ipcServer = await ipc.NativeIpcServer.listen("bw", (error, msg) => {
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
      name: MANIFEST_APP_NAME,
      description: "Bitwarden desktop <-> browser bridge",
      path: binaryPath,
      type: "stdio",
      allowed_origins: await this.loadChromeIds(),
    };
  }

  private async generateFirefoxJson(binaryPath: string) {
    return {
      name: MANIFEST_APP_NAME,
      description: "Bitwarden desktop <-> browser bridge",
      path: binaryPath,
      type: "stdio",
      allowed_extensions: [FIREFOX_EXTENSION_ID],
    };
  }

  async generateManifests() {
    const binaryPath = this.binaryPath();
    if (!existsSync(binaryPath)) {
      throw new Error(`Unable to find proxy binary: ${binaryPath}`);
    }

    switch (process.platform) {
      case "win32": {
        const destination = path.join(this.userPath, WINDOWS_BROWSERS_DIR);
        await this.writeManifest(
          path.join(destination, FIREFOX_MANIFEST_FILENAME),
          await this.generateFirefoxJson(binaryPath),
        );
        await this.writeManifest(
          path.join(destination, CHROME_MANIFEST_FILENAME),
          await this.generateChromeJson(binaryPath),
        );

        const nmhs = this.getWindowsNMHS();
        for (const [name, [key, subkey]] of Object.entries(nmhs)) {
          let manifestPath = path.join(destination, CHROME_MANIFEST_FILENAME);
          if (name === "Firefox") {
            manifestPath = path.join(destination, FIREFOX_MANIFEST_FILENAME);
          }
          await windows_registry.createKey(key, subkey, manifestPath);
        }
        break;
      }
      case "darwin": {
        const nmhs = this.getDarwinNMHS();
        for (const [key, value] of Object.entries(nmhs)) {
          if (existsSync(value)) {
            const p = path.join(value, NATIVE_MESSAGING_HOSTS_DIR, MANIFEST_FILENAME);

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
        // Because on linux, the path inside the sandbox is different, and we want to support:
        // Flatpak App, Unsandboxed App, Flatpak Browser, Unsandboxed Browser, Snap App, Unsandboxed App
        // and any combination of the above, we copy the binary to the applications native-messaging-hosts path
        // so that a canonical path to put in the manifest can be used.

        // Unsandboxed browser
        for (const [key, value] of Object.entries(this.getLinuxNMHS())) {
          if (existsSync(value)) {
            let nhmsPath = path.join(value, NATIVE_MESSAGING_HOSTS_DIR);
            if (key === "Firefox") {
              nhmsPath = path.join(value, FIREFOX_LINUX_NMHS_DIR);
            }
            const browserBinaryPath = path.join(nhmsPath, PROXY_BINARY_NAME);

            await fs.mkdir(nhmsPath, { recursive: true });
            await this.linkOrCopy(binaryPath, browserBinaryPath);
            this.logService.info(
              `[Native messaging] Hard-linked ${binaryPath} to ${browserBinaryPath}`,
            );

            if (key === "Firefox") {
              await this.writeManifest(
                path.join(nhmsPath, MANIFEST_FILENAME),
                await this.generateFirefoxJson(browserBinaryPath),
              );
            } else {
              await this.writeManifest(
                path.join(nhmsPath, MANIFEST_FILENAME),
                await this.generateChromeJson(browserBinaryPath),
              );
            }
          } else {
            this.logService.warning(`${key} not found, skipping.`);
          }
        }

        for (const [key, value] of Object.entries(this.getFlatpakNMHS())) {
          if (existsSync(value)) {
            const sandboxedProxyBinaryPath = path.join(value, PROXY_BINARY_NAME);
            await this.linkOrCopy(binaryPath, sandboxedProxyBinaryPath);
            this.logService.info(
              `[Native messaging] Hard-linked ${binaryPath} to ${sandboxedProxyBinaryPath}`,
            );

            if (key === "Firefox") {
              await this.writeManifest(
                path.join(value, MANIFEST_FILENAME),
                await this.generateFirefoxJson(sandboxedProxyBinaryPath),
              );
            } else if (key === "Chrome" || key === "Chromium" || key === "Microsoft Edge") {
              await this.writeManifest(
                path.join(value, MANIFEST_FILENAME),
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
      name: MANIFEST_APP_NAME,
      description: "Bitwarden desktop <-> DuckDuckGo bridge",
      path: this.binaryPath(),
      type: "stdio",
    };

    if (!existsSync(manifest.path)) {
      throw new Error(`Unable to find binary: ${manifest.path}`);
    }

    switch (process.platform) {
      case "darwin": {
        const manifestPath = `${this.homedir()}/${DUCKDUCKGO_MAC_NMHS_PATH}/${MANIFEST_FILENAME}`;
        await this.writeManifest(manifestPath, manifest);
        break;
      }
      default:
        break;
    }
  }

  async removeManifests() {
    switch (process.platform) {
      case "win32": {
        await this.removeIfExists(
          path.join(this.userPath, WINDOWS_BROWSERS_DIR, FIREFOX_MANIFEST_FILENAME),
        );
        await this.removeIfExists(
          path.join(this.userPath, WINDOWS_BROWSERS_DIR, CHROME_MANIFEST_FILENAME),
        );

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
            path.join(value, NATIVE_MESSAGING_HOSTS_DIR, MANIFEST_FILENAME),
          );
        }
        break;
      }
      case "linux": {
        for (const [key, value] of Object.entries(this.getLinuxNMHS())) {
          if (key === "Firefox") {
            await this.removeIfExists(
              path.join(value, FIREFOX_LINUX_NMHS_DIR, MANIFEST_FILENAME),
            );
          } else {
            await this.removeIfExists(
              path.join(value, NATIVE_MESSAGING_HOSTS_DIR, MANIFEST_FILENAME),
            );
          }
        }

        for (const [, value] of Object.entries(this.getFlatpakNMHS())) {
          await this.removeIfExists(path.join(value, MANIFEST_FILENAME));
          await this.removeIfExists(path.join(value, PROXY_BINARY_NAME));
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
        const manifestPath = `${this.homedir()}/${DUCKDUCKGO_MAC_NMHS_PATH}/${MANIFEST_FILENAME}`;
        await this.removeIfExists(manifestPath);
        break;
      }
      default:
        break;
    }
  }

  /*
    Helper functions to get the native messaging host paths for each platform.

    Note that for the chromium-based browsers (Edge, Brave, Vivaldi, etc.) they
    usually fallback to checking Chrome's NativeMessagingHosts path if the manifest
    is not found in their own path, but we still want to install the manifest in their
    own path as well if possible on macOS and Linux.

    This is because our code requires the browser paths to exist before installing the manifest,
    so the fallback included in these browsers won't work if the user hasn't installed Chrome
    first (or some other application created the folder for them).
  */

  private getWindowsNMHS() {
    return {
      Firefox: ["HKCU", `SOFTWARE\\Mozilla\\${NMHS_REGISTRY_KEY_SUFFIX}`],
      Chrome: ["HKCU", `SOFTWARE\\Google\\Chrome\\${NMHS_REGISTRY_KEY_SUFFIX}`],
      Chromium: ["HKCU", `SOFTWARE\\Chromium\\${NMHS_REGISTRY_KEY_SUFFIX}`],
      "Microsoft Edge": ["HKCU", `SOFTWARE\\Microsoft\\Edge\\${NMHS_REGISTRY_KEY_SUFFIX}`],
      Vivaldi: ["HKCU", `SOFTWARE\\Vivaldi\\${NMHS_REGISTRY_KEY_SUFFIX}`],
      Brave: ["HKCU", `SOFTWARE\\BraveSoftware\\Brave-Browser\\${NMHS_REGISTRY_KEY_SUFFIX}`],
    };
  }

  private getDarwinNMHS() {
    const appSupport = `${this.homedir()}/${DARWIN_APP_SUPPORT_PATH}`;
    return {
      Firefox: `${appSupport}/Mozilla/`,
      Chrome: `${appSupport}/Google/Chrome/`,
      "Chrome Beta": `${appSupport}/Google/Chrome Beta/`,
      "Chrome Dev": `${appSupport}/Google/Chrome Dev/`,
      "Chrome Canary": `${appSupport}/Google/Chrome Canary/`,
      Chromium: `${appSupport}/Chromium/`,
      "Microsoft Edge": `${appSupport}/Microsoft Edge/`,
      "Microsoft Edge Beta": `${appSupport}/Microsoft Edge Beta/`,
      "Microsoft Edge Dev": `${appSupport}/Microsoft Edge Dev/`,
      "Microsoft Edge Canary": `${appSupport}/Microsoft Edge Canary/`,
      Vivaldi: `${appSupport}/Vivaldi/`,
      Zen: `${appSupport}/Zen/`,
      Helium: `${appSupport}/net.imput.helium/`,
    };
  }

  private getLinuxNMHS() {
    return {
      Firefox: `${this.homedir()}/.mozilla/`,
      Chrome: `${this.homedir()}/.config/google-chrome/`,
      Chromium: `${this.homedir()}/.config/chromium/`,
      "Microsoft Edge": `${this.homedir()}/.config/microsoft-edge/`,
      Vivaldi: `${this.homedir()}/.config/vivaldi/`,
      Brave: `${this.homedir()}/.config/BraveSoftware/Brave-Browser/`,
    };
  }

  private getFlatpakNMHS() {
    const flatpakRoot = `${this.homedir()}/.var/app`;
    return {
      Firefox: `${flatpakRoot}/org.mozilla.firefox/.mozilla/${FIREFOX_LINUX_NMHS_DIR}/`,
      Chrome: `${flatpakRoot}/com.google.Chrome/config/google-chrome/${NATIVE_MESSAGING_HOSTS_DIR}/`,
      Chromium: `${flatpakRoot}/org.chromium.Chromium/config/chromium/${NATIVE_MESSAGING_HOSTS_DIR}/`,
      "Microsoft Edge": `${flatpakRoot}/com.microsoft.Edge/config/microsoft-edge/${NATIVE_MESSAGING_HOSTS_DIR}/`,
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
          path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", WINDOWS_BROWSER_USER_DATA_DIR),
          path.join(process.env.LOCALAPPDATA, "Google", "Chrome", WINDOWS_BROWSER_USER_DATA_DIR),
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
              await fs.readFile(
                path.join(chromePath, profile, CHROME_PREFERENCES_FILENAME),
                "utf8",
              ),
            );
            const commands: Map<string, any> = prefs.extensions.commands;

            // If one of the commands is autofill_login or generate_password, we know it's probably the Bitwarden extension
            for (const { command_name, extension } of Object.values(commands)) {
              if (command_name === "autofill_login" || command_name === "generate_password") {
                ids.add(`chrome-extension://${extension}/`);
                this.logService.info(`Found extension from ${chromePath}: ${extension}`);
              }
            }

            // Match via settings too. Sometimes global commands don't register properly.
            const settings: Map<string, any> = prefs.extensions.settings;
            for (const [extension, setting] of Object.entries(settings)) {
              if (setting.commands) {
                for (const [command_name] of Object.entries(setting.commands)) {
                  if (command_name === "autofill_login" || command_name === "generate_password") {
                    ids.add(`chrome-extension://${extension}/`);
                    this.logService.info(`Found extension ${chromePath}: ${extension}`);
                  }
                }
              }
            }
          } catch (e) {
            this.logService.info(`Error reading preferences: ${e}`);
          }
        }
      } catch {
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
        `${DESKTOP_PROXY_EXECUTABLE}${ext}`,
      );

      // isDev() returns true when using a production build with ELECTRON_IS_DEV=1,
      // so we need to fall back to the prod binary if the dev binary doesn't exist.
      if (existsSync(devPath)) {
        return devPath;
      }
    }

    return path.join(path.dirname(this.exePath), `${DESKTOP_PROXY_EXECUTABLE}${ext}`);
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
