import { existsSync, promises as fs } from "fs";
import { homedir, userInfo } from "os";
import * as path from "path";
import * as util from "util";

import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ipc } from "@bitwarden/desktop-napi";

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
          this.windowMain.win.webContents.send("nativeMessaging", JSON.parse(msg.message));
          break;
      }
    });

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
    this.ipcServer?.send(JSON.stringify(message));
  }

  async generateManifests() {
    const baseJson = {
      name: "com.8bit.bitwarden",
      description: "Bitwarden desktop <-> browser bridge",
      path: this.binaryPath(),
      type: "stdio",
    };

    if (!existsSync(baseJson.path)) {
      throw new Error(`Unable to find binary: ${baseJson.path}`);
    }

    const firefoxJson = {
      ...baseJson,
      ...{ allowed_extensions: ["{446900e4-71c2-419f-a6a7-df9c091e268b}"] },
    };
    const chromeJson = {
      ...baseJson,
      ...{
        allowed_origins: [
          // Chrome extension
          "chrome-extension://nngceckbapebfimnlniiiahkandclblb/",
          // Chrome beta extension
          "chrome-extension://hccnnhgbibccigepcmlgppchkpfdophk/",
          // Edge extension
          "chrome-extension://jbkfoedolllekgbhcbcoahefnbanhhlh/",
          // Opera extension
          "chrome-extension://ccnckbpmaceehanjmeomladnmlffdjgn/",
        ],
      },
    };

    switch (process.platform) {
      case "win32": {
        const destination = path.join(this.userPath, "browsers");
        await this.writeManifest(path.join(destination, "firefox.json"), firefoxJson);
        await this.writeManifest(path.join(destination, "chrome.json"), chromeJson);

        const nmhs = this.getWindowsNMHS();
        for (const [key, value] of Object.entries(nmhs)) {
          let manifestPath = path.join(destination, "chrome.json");
          if (key === "Firefox") {
            manifestPath = path.join(destination, "firefox.json");
          }
          await this.createWindowsRegistry(value, manifestPath);
        }
        break;
      }
      case "darwin": {
        const nmhs = this.getDarwinNMHS();
        for (const [key, value] of Object.entries(nmhs)) {
          if (existsSync(value)) {
            const p = path.join(value, "NativeMessagingHosts", "com.8bit.bitwarden.json");

            let manifest: any = chromeJson;
            if (key === "Firefox") {
              manifest = firefoxJson;
            }

            await this.writeManifest(p, manifest);
          } else {
            this.logService.warning(`${key} not found, skipping.`);
          }
        }
        break;
      }
      case "linux":
        if (existsSync(`${this.homedir()}/.mozilla/`)) {
          await this.writeManifest(
            `${this.homedir()}/.mozilla/native-messaging-hosts/com.8bit.bitwarden.json`,
            firefoxJson,
          );
        }

        if (existsSync(`${this.homedir()}/.config/google-chrome/`)) {
          await this.writeManifest(
            `${this.homedir()}/.config/google-chrome/NativeMessagingHosts/com.8bit.bitwarden.json`,
            chromeJson,
          );
        }

        if (existsSync(`${this.homedir()}/.config/microsoft-edge/`)) {
          await this.writeManifest(
            `${this.homedir()}/.config/microsoft-edge/NativeMessagingHosts/com.8bit.bitwarden.json`,
            chromeJson,
          );
        }
        break;
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
        for (const [, value] of Object.entries(nmhs)) {
          await this.deleteWindowsRegistry(value);
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
        await this.removeIfExists(
          `${this.homedir()}/.mozilla/native-messaging-hosts/com.8bit.bitwarden.json`,
        );
        await this.removeIfExists(
          `${this.homedir()}/.config/google-chrome/NativeMessagingHosts/com.8bit.bitwarden.json`,
        );
        await this.removeIfExists(
          `${this.homedir()}/.config/microsoft-edge/NativeMessagingHosts/com.8bit.bitwarden.json`,
        );
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
      Firefox: "HKCU\\SOFTWARE\\Mozilla\\NativeMessagingHosts\\com.8bit.bitwarden",
      Chrome: "HKCU\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.8bit.bitwarden",
      Chromium: "HKCU\\SOFTWARE\\Chromium\\NativeMessagingHosts\\com.8bit.bitwarden",
      // Edge uses the same registry key as Chrome as a fallback, but it's has its own separate key as well.
      "Microsoft Edge": "HKCU\\SOFTWARE\\Microsoft\\Edge\\NativeMessagingHosts\\com.8bit.bitwarden",
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
    };
    /* eslint-enable no-useless-escape */
  }

  private async writeManifest(destination: string, manifest: object) {
    this.logService.debug(`Writing manifest: ${destination}`);

    if (!existsSync(path.dirname(destination))) {
      await fs.mkdir(path.dirname(destination));
    }

    await fs.writeFile(destination, JSON.stringify(manifest, null, 2));
  }

  private binaryPath() {
    if (isDev()) {
      return path.join(this.appPath, "..", "desktop_native", "target", "debug", "desktop_proxy");
    }

    switch (process.platform) {
      case "darwin": {
        // exePath is <path-to-app>/Bitwarden.app/Contents/MacOS/Bitwarden"
        return path.join(path.dirname(this.exePath), "..", "Resources", "desktop_proxy");
      }
      case "win32": {
        return path.join(path.dirname(this.exePath), "desktop_proxy.exe");
      }
      default:
        return path.join(path.dirname(this.exePath), "desktop_proxy");
    }
  }

  private getRegeditInstance() {
    // eslint-disable-next-line
    const regedit = require("regedit");
    regedit.setExternalVBSLocation(path.join(path.dirname(this.exePath), "resources/regedit/vbs"));

    return regedit;
  }

  private async createWindowsRegistry(location: string, jsonFile: string) {
    const regedit = this.getRegeditInstance();

    const createKey = util.promisify(regedit.createKey);
    const putValue = util.promisify(regedit.putValue);

    this.logService.debug(`Adding registry: ${location}`);

    await createKey(location);

    // Insert path to manifest
    const obj: any = {};
    obj[location] = {
      default: {
        value: jsonFile,
        type: "REG_DEFAULT",
      },
    };

    return putValue(obj);
  }

  private async deleteWindowsRegistry(key: string) {
    const regedit = this.getRegeditInstance();

    const list = util.promisify(regedit.list);
    const deleteKey = util.promisify(regedit.deleteKey);

    this.logService.debug(`Removing registry: ${key}`);

    try {
      await list(key);
      await deleteKey(key);
    } catch {
      this.logService.error(`Unable to delete registry key: ${key}`);
    }
  }

  private homedir() {
    if (process.platform === "darwin") {
      return userInfo().homedir;
    } else {
      return homedir();
    }
  }

  private async removeIfExists(path: string) {
    if (existsSync(path)) {
      await fs.unlink(path);
    }
  }
}
