import { VaultTimeout } from "../../vault-timeout";

export abstract class SessionTimeoutTypeService {
  /**
   * Is provided timeout type available on this client type, OS ?
   * @param timeout the timeout type
   */
  abstract isAvailable(timeout: VaultTimeout): Promise<boolean>;

  /**
   * Returns the highest available and permissive timeout type, that is higher or equals than the provided.
   * @param timeout the provided timeout type
   */
  abstract getHighestAvailable(timeout: VaultTimeout): Promise<VaultTimeout>;
}
