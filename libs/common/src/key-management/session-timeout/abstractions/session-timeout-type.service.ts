import { VaultTimeout } from "../../vault-timeout";

export abstract class SessionTimeoutTypeService {
  /**
   * Is provided timeout type available on this client type, OS ?
   * @param timeout the timeout type
   */
  abstract isAvailable(timeout: VaultTimeout): Promise<boolean>;

  /**
   * Returns the highest available and permissive timeout type, that is higher than or equals the provided timeout type.
   * @param timeout the provided timeout type
   */
  abstract getOrPromoteToAvailable(timeout: VaultTimeout): Promise<VaultTimeout>;
}
