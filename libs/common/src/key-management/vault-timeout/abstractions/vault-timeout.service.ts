export abstract class VaultTimeoutService {
  abstract checkVaultTimeout(): Promise<void>;
  abstract lock(userId?: string): Promise<void>;
  abstract logOut(userId?: string): Promise<void>;
}
