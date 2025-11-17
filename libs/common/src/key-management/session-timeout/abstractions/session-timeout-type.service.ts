import { VaultTimeout } from "../../vault-timeout";

export abstract class SessionTimeoutTypeService {
  /**
   * Is provided timeout type available on this client type, OS ?
   * @param timeout the timeout type
   */
  abstract isAvailable(timeout: VaultTimeout): Promise<boolean>;

  /**
   * Returns the highest available timeout type available, that is lower or equals than the provided.
   * @param timeout the provided timeout type
   */
  abstract getHighestAvailable(timeout: VaultTimeout): Promise<VaultTimeout>;
}
