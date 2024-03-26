import { ipcRenderer } from "electron";

import { DeviceType } from "@bitwarden/common/enums";
import { ThemeType, KeySuffixOptions, LogLevelType } from "@bitwarden/common/platform/enums";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

import {
  EncryptedMessageResponse,
  LegacyMessageWrapper,
  Message,
  UnencryptedMessageResponse,
} from "../models/native-messaging";
import { BiometricMessage, BiometricAction } from "../types/biometric-message";
import { isDev, isMacAppStore, isWindowsStore } from "../utils";

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

const biometric = {
  enabled: (userId: string): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.EnabledForUser,
      key: `${userId}_user_biometric`,
      keySuffix: KeySuffixOptions.Biometric,
      userId: userId,
    } satisfies BiometricMessage),
  osSupported: (): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.OsSupported,
    } satisfies BiometricMessage),
  authenticate: (): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.Authenticate,
    } satisfies BiometricMessage),
};

const clipboard = {
  read: (): Promise<string> => ipcRenderer.invoke("clipboard.read"),
  write: (message: ClipboardWriteMessage) => ipcRenderer.invoke("clipboard.write", message),
};

const nativeMessaging = {
  sendReply: (message: EncryptedMessageResponse | UnencryptedMessageResponse) => {
    ipcRenderer.send("nativeMessagingReply", message);
  },
  sendMessage: (message: {
    appId: string;
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

const crypto = {
  argon2: (
    password: string | Uint8Array,
    salt: string | Uint8Array,
    iterations: number,
    memory: number,
    parallelism: number,
  ): Promise<Uint8Array> =>
    ipcRenderer.invoke("crypto.argon2", { password, salt, iterations, memory, parallelism }),
};

export default {
  versions: {
    app: (): Promise<string> => ipcRenderer.invoke("appVersion"),
  },
  deviceType: deviceType(),
  isDev: isDev(),
  isMacAppStore: isMacAppStore(),
  isWindowsStore: isWindowsStore(),
  reloadProcess: () => ipcRenderer.send("reload-process"),
  log: (level: LogLevelType, message: string) => ipcRenderer.invoke("ipc.log", { level, message }),

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
  onMessage: (callback: (message: { command: string } & any) => void) => {
    ipcRenderer.on("messagingService", (_event, message: any) => {
      if (message.command) {
        callback(message);
      }
    });
  },

  launchUri: (uri: string) => ipcRenderer.invoke("launchUri", uri),

  storage,
  passwords,
  biometric,
  clipboard,
  nativeMessaging,
  crypto,
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
