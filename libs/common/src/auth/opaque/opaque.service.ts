import { UserKey } from "../../types/key";

import { KsfConfig } from "./models/cipher-configuration";

export abstract class OpaqueService {
  /**
   * Register a user to use the Opaque login method.
   */
  abstract register(masterPassword: string, userKey: UserKey, ksfConfig: KsfConfig): Promise<void>;

  /**
   * Authenticate using the Opaque login method. Returns the export key, which must be used
   * in combination with the rotateable keyset returned from the token endpoint.
   * @returns The ExportKey obtained during the Opaque login flow.
   */
  abstract login(email: string, masterPassword: string, ksfConfig: KsfConfig): Promise<Uint8Array>;
}
