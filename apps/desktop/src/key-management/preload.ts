import { ipcRenderer } from "electron";
import { Jsonify } from "type-fest";

import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsStatus } from "@bitwarden/key-management";

import { BiometricMessage, BiometricAction } from "../types/biometric-message";

import {
  AUTOMATION_BIOMETRIC_CHANNEL,
  AutomationBiometricAction,
  AutomationBiometricMessage,
  AutomationBiometricRequest,
} from "./biometrics/automation-biometric-message";

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

// Automation-only surface, controlled by the renderer automation driver (dev mode only).
const automation = {
  biometrics: {
    setStatus: (status: BiometricsStatus): Promise<void> =>
      ipcRenderer.invoke(AUTOMATION_BIOMETRIC_CHANNEL, {
        action: AutomationBiometricAction.SetStatus,
        status: status,
      } satisfies AutomationBiometricMessage),
    listPending: (): Promise<AutomationBiometricRequest[]> =>
      ipcRenderer.invoke(AUTOMATION_BIOMETRIC_CHANNEL, {
        action: AutomationBiometricAction.ListPending,
      } satisfies AutomationBiometricMessage),
    approve: (id?: string): Promise<void> =>
      ipcRenderer.invoke(AUTOMATION_BIOMETRIC_CHANNEL, {
        action: AutomationBiometricAction.Approve,
        id: id,
      } satisfies AutomationBiometricMessage),
    deny: (id?: string): Promise<void> =>
      ipcRenderer.invoke(AUTOMATION_BIOMETRIC_CHANNEL, {
        action: AutomationBiometricAction.Deny,
        id: id,
      } satisfies AutomationBiometricMessage),
  },
};

export default {
  biometric,
  automation,
};
