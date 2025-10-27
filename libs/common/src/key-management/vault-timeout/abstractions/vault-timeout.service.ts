export abstract class VaultTimeoutService {
  abstract checkVaultTimeout(): Promise<void>;
  /**
   * @deprecated Use lockService instead
   */
  abstract lock(userId?: string): Promise<void>;
}
