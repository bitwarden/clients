import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { PureCrypto } from "@bitwarden/sdk-internal";

/**
 * How long the session key the process is running under is good for.
 *
 * `BW_SESSION` is the key {@link NodeEnvSecureStorageService} encrypts protected state with, so
 * this decides whether that state is worth persisting: a key the user holds outlives the
 * process, a key we minted only for ourselves does not.
 */
export const SessionKeyLifetime = Object.freeze({
  /** The user supplied it, or `bw unlock` is about to hand it back to them. */
  Durable: "durable",
  /** Minted so an unlock has somewhere to go. Dies with the process. */
  Ephemeral: "ephemeral",
} as const);
export type SessionKeyLifetime = (typeof SessionKeyLifetime)[keyof typeof SessionKeyLifetime];

/**
 * Owns `process.env.BW_SESSION` for the lifetime of the process.
 *
 * Exactly one session key may exist per process. Rotating it after an unlock has already written
 * protected state under the old key leaves that state undecryptable, so a key is minted at most
 * once and {@link rotate} refuses to run once the key is in use.
 */
export class CliSessionKeyService {
  private lifetime?: SessionKeyLifetime;
  private inUse = false;

  /** The lifetime of the session key in play, or `undefined` before {@link ensure} has run. */
  get keyLifetime(): SessionKeyLifetime | undefined {
    return this.lifetime;
  }

  /**
   * Whether the session key dies with this process, so protected state written under it must not
   * be persisted.
   */
  get ephemeral(): boolean {
    return this.lifetime === SessionKeyLifetime.Ephemeral;
  }

  /**
   * Makes sure a session key exists, minting one only if the environment has none. Idempotent.
   *
   * Callers must run this before anything can unlock the vault, because a shared unlock lands
   * inside an SDK driver callback rather than in command code.
   */
  async ensure(): Promise<SessionKeyLifetime> {
    if (this.lifetime != null) {
      return this.lifetime;
    }

    if (process.env.BW_SESSION != null && process.env.BW_SESSION !== "") {
      this.lifetime = SessionKeyLifetime.Durable;
      return this.lifetime;
    }

    process.env.BW_SESSION = await this.newKey();
    this.lifetime = SessionKeyLifetime.Ephemeral;
    return this.lifetime;
  }

  /**
   * Replaces the session key with a fresh one that the caller is expected to hand to the user, so
   * `bw unlock` never reports a key the user already had.
   *
   * @throws if the key in play has already unlocked the vault.
   */
  async rotate(): Promise<void> {
    if (this.inUse) {
      throw new Error(
        "The session key cannot be rotated after it has been used to unlock the vault.",
      );
    }

    process.env.BW_SESSION = await this.newKey();
    this.lifetime = SessionKeyLifetime.Durable;
  }

  /** Freezes the session key against {@link rotate}, because it has now unlocked the vault. */
  markInUse(): void {
    this.inUse = true;
  }

  private async newKey(): Promise<string> {
    await SdkLoadService.Ready;
    return SymmetricCryptoKey.fromSdk(PureCrypto.make_aes256_cbc_hmac_key()).toBase64();
  }
}
