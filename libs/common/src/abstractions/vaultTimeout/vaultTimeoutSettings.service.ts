import { Guid } from "../../types/guid";

export abstract class VaultTimeoutSettingsService {
  setVaultTimeoutOptions: (vaultTimeout: number, vaultTimeoutAction: string) => Promise<void>;
  getVaultTimeout: (userId?: Guid) => Promise<number>;
  isPinLockSet: () => Promise<[boolean, boolean]>;
  isBiometricLockSet: () => Promise<boolean>;
  clear: (userId?: Guid) => Promise<void>;
}
