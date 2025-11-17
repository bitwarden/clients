import { ipcRenderer } from "electron";
import { Jsonify } from "type-fest";

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
  unlockWithBiometricsForUser: (userId: string): Promise<Jsonify<UserKey> | null> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.UnlockForUser,
      userId: userId,
    } satisfies BiometricMessage),
  getBiometricsStatusForUser: (userId: string): Promise<BiometricsStatus> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.GetStatusForUser,
      userId: userId,
    } satisfies BiometricMessage),
  setBiometricProtectedUnlockKeyForUser: (userId: string, keyB64: string): Promise<void> => {
    return ipcRenderer.invoke("biometric", {
      action: BiometricAction.SetKeyForUser,
      userId: userId,
      key: keyB64,
    } satisfies BiometricMessage);
  },
  deleteBiometricUnlockKeyForUser: (userId: string): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.RemoveKeyForUser,
      userId: userId,
    } satisfies BiometricMessage),
  setupBiometrics: (): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.Setup,
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
  enrollPersistent: (userId: string, keyB64: string): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.EnrollPersistent,
      userId: userId,
      key: keyB64,
    } satisfies BiometricMessage),
  hasPersistentKey: (userId: string): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.HasPersistentKey,
      userId: userId,
    } satisfies BiometricMessage),
  enableWindowsV2Biometrics: (): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.EnableWindowsV2,
    } satisfies BiometricMessage),
  isWindowsV2BiometricsEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.IsWindowsV2Enabled,
    } satisfies BiometricMessage),
  enableLinuxV2Biometrics: (): Promise<void> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.EnableLinuxV2,
    } satisfies BiometricMessage),
  isLinuxV2BiometricsEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke("biometric", {
      action: BiometricAction.IsLinuxV2Enabled,
    } satisfies BiometricMessage),
};

export default {
  biometric,
};
