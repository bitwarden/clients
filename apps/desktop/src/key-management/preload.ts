import { ipcRenderer } from "electron";

import { KeySuffixOptions } from "@bitwarden/key-management";

import { BiometricMessage, BiometricAction } from "../types/biometric-message";

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
  biometricsNeedsSetup: (): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.NeedsSetup,
    } satisfies BiometricMessage),
  biometricsSetup: (): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.Setup,
    } satisfies BiometricMessage),
  biometricsCanAutoSetup: (): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.CanAutoSetup,
    } satisfies BiometricMessage),
  authenticate: (): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.Authenticate,
    } satisfies BiometricMessage),
};

export default {
  biometric,
};
