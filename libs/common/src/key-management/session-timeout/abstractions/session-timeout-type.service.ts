import { VaultTimeout } from "../../vault-timeout";

export abstract class SessionTimeoutTypeService {
  /**
   * Is provided timeout type available on this client type, OS ?
   * @param timeout the timeout type
   */
  abstract isAvailable(timeout: VaultTimeout): Promise<boolean>;
}
