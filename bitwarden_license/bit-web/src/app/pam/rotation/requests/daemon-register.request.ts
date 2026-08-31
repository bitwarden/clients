// Pre-existing usage, not new crypto — the libs/common/src/key-management/crypto shim this
// reached through was deleted upstream. See daemon-registration.service.ts.
// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";

/**
 * Body for `POST /organizations/{orgId}/rotation/daemons`.
 *
 * NOTE — `name` is DELIBERATELY plaintext. The server stores `PamDaemon.Name` as a plaintext
 * `nvarchar(200)` column and audit rows snapshot it at write time. This is a deliberate
 * divergence from Secrets Manager's encrypted ApiKey name. Open contract item: align with the
 * server team before GA; if the column moves to encrypted the client-side token-format derivation
 * and DaemonRegistrationService must both change.
 *
 * `encryptedPayload` and `key` serialize via {@link EncString.toJSON} — the wire value is the
 * standard ciphertext string representation, not an object.
 */
export class DaemonRegisterRequest {
  /** Plaintext daemon name — see class-level doc comment. */
  name: string;
  /** The daemon's key material, encrypted with the org key. */
  encryptedPayload: EncString;
  /** The derived key itself, encrypted with the org key, used to unwrap the payload. */
  key: EncString;

  constructor(init: { name: string; encryptedPayload: EncString; key: EncString }) {
    this.name = init.name;
    this.encryptedPayload = init.encryptedPayload;
    this.key = init.key;
  }
}
