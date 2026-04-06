export abstract class VaultTimeoutService {
  abstract checkVaultTimeout(): Promise<void>;
}
