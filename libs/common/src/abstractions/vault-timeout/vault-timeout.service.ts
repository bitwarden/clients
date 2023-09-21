export abstract class VaultTimeoutService {
  checkVaultTimeout: () => Promise<void>;
  lock: (userId?: string) => Promise<void>;
  logOut: (userId?: string) => Promise<void>;
}
