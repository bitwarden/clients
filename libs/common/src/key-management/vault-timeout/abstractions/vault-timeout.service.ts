export abstract class VaultTimeoutService {
  abstract checkVaultTimeout(): Promise<void>;
  abstract logOut(userId?: string): Promise<void>;
}
