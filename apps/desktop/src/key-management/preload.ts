import { ipcRenderer } from "electron";
import { Jsonify } from "type-fest";

import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsStatus } from "@bitwarden/key-management";

import { BiometricMessage, BiometricAction } from "../types/biometric-message";

import {
  UserKeyStateAction,
  UserKeyStateMessage,
  UserKeyStateUpdate,
} from "./user-key-state/user-key-state-message";

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
};

const userKeyState = {
  get: (userId: string): Promise<string | null> =>
    ipcRenderer.invoke("userKeyState", {
      action: UserKeyStateAction.Get,
      userId: userId,
    } satisfies UserKeyStateMessage),
  set: (userId: string, keyB64: string | null): Promise<void> =>
    ipcRenderer.invoke("userKeyState", {
      action: UserKeyStateAction.Set,
      userId: userId,
      key: keyB64,
    } satisfies UserKeyStateMessage),
  onUpdate: (callback: (update: UserKeyStateUpdate) => void) => {
    ipcRenderer.on("userKeyState.update", (_event, update: UserKeyStateUpdate) => callback(update));
  },
};

export default {
  biometric,
  userKeyState,
};
