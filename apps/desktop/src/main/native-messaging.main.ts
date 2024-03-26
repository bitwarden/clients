import { existsSync, promises as fs } from "fs";
import { Socket } from "net";
import { homedir, userInfo } from "os";
import * as path from "path";
import * as util from "util";

import { ipcMain } from "electron";
import * as ipc from "node-ipc";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { getIpcSocketRoot } from "../proxy/ipc";

import { WindowMain } from "./window.main";

export class NativeMessagingMain {
  private connected: Socket[] = [];
  private socket: any;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
    private userPath: string,
    private exePath: string,
  ) {
    ipcMain.handle(
      "nativeMessaging.manifests",
      async (_event: any, options: { create: boolean }) => {
        if (options.create) {
          this.listen();
          try {
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
          this.listen();
          try {
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

  listen() {
    ipc.config.id = "bitwarden";
    ipc.config.retry = 1500;
    const ipcSocketRoot = getIpcSocketRoot();
    if (ipcSocketRoot != null) {
      ipc.config.socketRoot = ipcSocketRoot;
    }

    ipc.serve(() => {
      ipc.server.on("message", (data: any, socket: any) => {
        this.socket = socket;
        this.windowMain.win.webContents.send("nativeMessaging", data);
      });

      ipcMain.on("nativeMessagingReply", (event, msg) => {
        if (this.socket != null && msg != null) {
          this.send(msg, this.socket);
        }
      });

      ipc.server.on("connect", (socket: Socket) => {
        this.connected.push(socket);
      });

      ipc.server.on("socket.disconnected", (socket, destroyedSocketID) => {
        const index = this.connected.indexOf(socket);
        if (index > -1) {
          this.connected.splice(index, 1);
        }

        this.socket = null;
        ipc.log("client " + destroyedSocketID + " has disconnected!");
      });
    });

    ipc.server.start();
  }

  stop() {
    ipc.server.stop();
    // Kill all existing connections
    this.connected.forEach((socket) => {
      if (!socket.destroyed) {
        socket.destroy();
      }
    });
  }

  send(message: object, socket: any) {
    ipc.server.emit(socket, "message", message);
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
    if (process.platform === "win32") {
      return path.join(path.dirname(this.exePath), "resources", "native-messaging.bat");
    }

    return this.exePath;
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
