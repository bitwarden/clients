import { OpaqueSessionId } from "@bitwarden/common/types/guid";

import { UserKey } from "../../types/key";

import { CipherConfiguration } from "./models/cipher-configuration";

export abstract class OpaqueKeyExchangeService {
  /**
   * Register a user to use the Opaque login method.
   */
  abstract register(
    masterPassword: string,
    userKey: UserKey,
    cipherConfiguration: CipherConfiguration,
  ): Promise<OpaqueSessionId>;

  /**
   * Authenticate using the Opaque login method. Returns the export key, which must be used
   * in combination with the rotateable keyset returned from the token endpoint.
   * @returns The ExportKey obtained during the Opaque login flow.
   */
  abstract login(
    email: string,
    masterPassword: string,
    cipherConfiguration: CipherConfiguration,
  ): Promise<Uint8Array>;
}
