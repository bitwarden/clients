import { ipcRenderer } from "electron";

import { DeviceType } from "@bitwarden/common/enums";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ThemeType, LogLevelType } from "@bitwarden/common/platform/enums";
import { ForwardedIpcMessage, IpcMessage } from "@bitwarden/common/platform/ipc";

import {
  EncryptedMessageResponse,
  LegacyMessageWrapper,
  Message,
  UnencryptedMessageResponse,
} from "../models/native-messaging";
import {
  allowBrowserintegrationOverride,
  isAppImage,
  isDev,
  isFlatpak,
  isMacAppStore,
  isSnapStore,
  isWindowsStore,
} from "../utils";

import { ClipboardWriteMessage } from "./types/clipboard";

const storage = {
  get: <T>(key: string): Promise<T> => ipcRenderer.invoke("storageService", { action: "get", key }),
  has: (key: string): Promise<boolean> =>
    ipcRenderer.invoke("storageService", { action: "has", key }),
  save: (key: string, obj: any): Promise<void> =>
    ipcRenderer.invoke("storageService", { action: "save", key, obj }),
  remove: (key: string): Promise<void> =>
    ipcRenderer.invoke("storageService", { action: "remove", key }),
};

const passwords = {
  get: (key: string, keySuffix: string): Promise<string> =>
    ipcRenderer.invoke("keytar", { action: "getPassword", key, keySuffix }),
  has: (key: string, keySuffix: string): Promise<boolean> =>
    ipcRenderer.invoke("keytar", { action: "hasPassword", key, keySuffix }),
  set: (key: string, keySuffix: string, value: string): Promise<void> =>
    ipcRenderer.invoke("keytar", { action: "setPassword", key, keySuffix, value }),
  delete: (key: string, keySuffix: string): Promise<void> =>
    ipcRenderer.invoke("keytar", { action: "deletePassword", key, keySuffix }),
};

const clipboard = {
  read: (): Promise<string> => ipcRenderer.invoke("clipboard.read"),
  write: (message: ClipboardWriteMessage) => ipcRenderer.invoke("clipboard.write", message),
};

const sshAgent = {
  init: async () => {
    await ipcRenderer.invoke("sshagent.init");
  },
  setKeys: (keys: { name: string; privateKey: string; cipherId: string }[]): Promise<void> =>
    ipcRenderer.invoke("sshagent.setkeys", keys),
  signRequestResponse: async (requestId: number, accepted: boolean) => {
    await ipcRenderer.invoke("sshagent.signrequestresponse", { requestId, accepted });
  },
  lock: async () => {
    return await ipcRenderer.invoke("sshagent.lock");
  },
  clearKeys: async () => {
    return await ipcRenderer.invoke("sshagent.clearkeys");
  },
  isLoaded(): Promise<boolean> {
    return ipcRenderer.invoke("sshagent.isloaded");
  },
};

const powermonitor = {
  isLockMonitorAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke("powermonitor.isLockMonitorAvailable"),
};

const nativeMessaging = {
  sendReply: (message: EncryptedMessageResponse | UnencryptedMessageResponse) => {
    ipcRenderer.send("nativeMessagingReply", message);
  },
  sendMessage: (message: {
    appId: string;
    messageId?: number;
    command?: string;
    sharedSecret?: string;
    message?: EncString;
  }) => {
    ipcRenderer.send("nativeMessagingReply", message);
  },
  onMessage: (callback: (message: LegacyMessageWrapper | Message) => void) => {
    ipcRenderer.on("nativeMessaging", (_event, message) => callback(message));
  },

  manifests: {
    generate: (create: boolean): Promise<Error | null> =>
      ipcRenderer.invoke("nativeMessaging.manifests", { create }),
    generateDuckDuckGo: (create: boolean): Promise<Error | null> =>
      ipcRenderer.invoke("nativeMessaging.ddgManifests", { create }),
  },
};

const ipcService = {
  onMessage: (callback: (message: ForwardedIpcMessage) => void) => {
    ipcRenderer.on("ipc.onMessage", (_event, message: ForwardedIpcMessage) => {
      callback(message);
    });
  },

  send: (message: IpcMessage) => {
    ipcRenderer.send("ipc.send", message);
  },
};

const ephemeralStore = {
  setEphemeralValue: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke("setEphemeralValue", { key, value }),
  getEphemeralValue: (key: string): Promise<string> => ipcRenderer.invoke("getEphemeralValue", key),
  removeEphemeralValue: (key: string): Promise<void> =>
    ipcRenderer.invoke("deleteEphemeralValue", key),
  listEphemeralValueKeys: (): Promise<string[]> => ipcRenderer.invoke("listEphemeralValueKeys"),
};

const localhostCallbackService = {
  openSsoPrompt: (codeChallenge: string, state: string, email: string): Promise<void> => {
    return ipcRenderer.invoke("openSsoPrompt", { codeChallenge, state, email });
  },
};

export default {
  versions: {
    app: (): Promise<string> => ipcRenderer.invoke("appVersion"),
    registerSdkVersionProvider: (provide: (resolve: (version: string) => void) => void) => {
      const resolve = (version: string) => ipcRenderer.send("sdkVersion", version);

      ipcRenderer.on("sdkVersion", () => {
        provide(resolve);
      });
    },
  },
  deviceType: deviceType(),
  isDev: isDev(),
  isMacAppStore: isMacAppStore(),
  isWindowsStore: isWindowsStore(),
  isFlatpak: isFlatpak(),
  isSnapStore: isSnapStore(),
  isAppImage: isAppImage(),
  allowBrowserintegrationOverride: allowBrowserintegrationOverride(),
  reloadProcess: () => ipcRenderer.send("reload-process"),
  focusWindow: () => ipcRenderer.send("window-focus"),
  hideWindow: () => ipcRenderer.send("window-hide"),
  log: (level: LogLevelType, message?: any, ...optionalParams: any[]) =>
    ipcRenderer.invoke("ipc.log", { level, message, optionalParams }),

  openContextMenu: (
    menu: {
      label?: string;
      type?: "normal" | "separator" | "submenu" | "checkbox" | "radio";
    }[],
  ): Promise<number> => ipcRenderer.invoke("openContextMenu", { menu }),

  getSystemTheme: (): Promise<ThemeType> => ipcRenderer.invoke("systemTheme"),
  onSystemThemeUpdated: (callback: (theme: ThemeType) => void) => {
    ipcRenderer.on("systemThemeUpdated", (_event, theme: ThemeType) => callback(theme));
  },

  isWindowVisible: (): Promise<boolean> => ipcRenderer.invoke("windowVisible"),

  getLanguageFile: (formattedLocale: string): Promise<object> =>
    ipcRenderer.invoke("getLanguageFile", formattedLocale),

  sendMessage: (message: { command: string } & any) =>
    ipcRenderer.send("messagingService", message),
  onMessage: {
    addListener: (callback: (message: { command: string } & any) => void) => {
      ipcRenderer.addListener("messagingService", (_event, message: any) => {
        if (message.command) {
          callback(message);
        }
      });
    },
    removeListener: (callback: (message: { command: string } & any) => void) => {
      ipcRenderer.removeListener("messagingService", (_event, message: any) => {
        if (message.command) {
          callback(message);
        }
      });
    },
  },

  launchUri: (uri: string) => ipcRenderer.invoke("launchUri", uri),

  storage,
  passwords,
  clipboard,
  sshAgent,
  powermonitor,
  nativeMessaging,
  crypto,
  ephemeralStore,
  localhostCallbackService,
  ipcService,
};

function deviceType(): DeviceType {
  switch (process.platform) {
    case "win32":
      return DeviceType.WindowsDesktop;
    case "darwin":
      return DeviceType.MacOsDesktop;
    default:
      return DeviceType.LinuxDesktop;
  }
}
