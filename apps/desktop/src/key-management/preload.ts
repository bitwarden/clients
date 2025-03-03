import { ipcRenderer } from "electron";

import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsStatus } from "@bitwarden/key-management";

import { BiometricMessage, BiometricAction } from "../types/biometric-message";

const biometric = {
  authenticateWithBiometrics: (): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.Authenticate,
    } satisfies BiometricMessage),
  getBiometricsStatus: (): Promise<BiometricsStatus> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.GetStatus,
    } satisfies BiometricMessage),
  unlockWithBiometricsForUser: (userId: string): Promise<UserKey | null> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.UnlockForUser,
      userId: userId,
    } satisfies BiometricMessage),
  getBiometricsStatusForUser: (userId: string): Promise<BiometricsStatus> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.GetStatusForUser,
      userId: userId,
    } satisfies BiometricMessage),
  setBiometricProtectedUnlockKeyForUser: (userId: string, value: string): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.SetKeyForUser,
      userId: userId,
      key: value,
    } satisfies BiometricMessage),
  deleteBiometricUnlockKeyForUser: (userId: string): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.RemoveKeyForUser,
      userId: userId,
    } satisfies BiometricMessage),
  setupBiometrics: (): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.Setup,
    } satisfies BiometricMessage),
  setClientKeyHalf: (userId: string, value: string | null): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.SetClientKeyHalf,
      userId: userId,
      key: value,
    } satisfies BiometricMessage),
  getShouldAutoprompt: (): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.GetShouldAutoprompt,
    } satisfies BiometricMessage),
  setShouldAutoprompt: (should: boolean): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.SetShouldAutoprompt,
      data: should,
    } satisfies BiometricMessage),
};

export default {
  biometric,
};
