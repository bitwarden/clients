import { firstValueFrom, map, switchMap } from "rxjs";

import {
  CipherListView,
  CipherView as SdkCipherView,
  EncryptionContext,
  Fido2CredentialStore,
} from "@bitwarden/sdk-internal";

import { AccountService } from "../../../auth/abstractions/account.service";
import { getUserId } from "../../../auth/services/account.service";
import { CipherId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { CipherType } from "../../../vault/enums";
import { Cipher } from "../../../vault/models/domain/cipher";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { SdkService } from "../../abstractions/sdk/sdk.service";

import { compareCredentialIds, parseCredentialId } from "./credential-id-utils";

/**
 * Satisfies the SDK's `Fido2CredentialStore` using the clients vault.
 *
 * The filter rules match `Fido2AuthenticatorService`'s `findCredentialsById` /
 * `findCredentialsByRp`, so a ceremony run through the SDK sees the same credentials it would
 * today.
 */
export class SdkFido2CredentialStore implements Fido2CredentialStore {
  constructor(
    private cipherService: CipherService,
    private accountService: AccountService,
    private sdkService: SdkService,
  ) {}

  /**
   * `ids` and `user_handle` arrive as `number[]`, not `Uint8Array` — `serde_wasm_bindgen` does not
   * emit a `Uint8Array` for a plain `Vec<u8>`. `user_handle` is ignored, as in the TypeScript path;
   * filtering on it would change which credentials a relying party can see.
   *
   * `rip_id` is misspelled to match the SDK interface. Renaming it stops the object satisfying it.
   */
  async find_credentials(
    ids: number[][] | undefined,
    rip_id: string,
    user_handle: number[] | undefined,
  ): Promise<SdkCipherView[]> {
    const matching = await this.findCredentialCiphers(
      ids?.map((id) => new Uint8Array(id)),
      rip_id,
    );

    return await this.reReadThroughSdk(matching);
  }

  /**
   * Re-reads each match as an SDK `CipherView`, through the SDK's own decrypt.
   *
   * `CipherView.toSdkCipherView()` must not be used here: it sets `login.fido2Credentials` to
   * `undefined` (`login.view.ts:151`), because clients holds passkeys decrypted while the SDK's
   * field wants `EncString`s. Every cipher would reach the authenticator with no passkeys on it.
   */
  private async reReadThroughSdk(ciphers: CipherView[]): Promise<SdkCipherView[]> {
    if (ciphers.length === 0) {
      return [];
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const records = await firstValueFrom(this.cipherService.ciphers$(userId));

    const sdkCiphers = ciphers
      .map((cipher) => (cipher.id == null ? undefined : records?.[cipher.id as CipherId]))
      .filter((data) => data !== undefined)
      .map((data) => new Cipher(data, undefined).toSdkCipher());

    // The client is only valid inside the subscription — see the warning on `userClient$`.
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("Cannot read FIDO2 credentials: the SDK client is unavailable.");
          }
          using ref = sdk.take();
          const ciphersClient = ref.value.vault().ciphers();

          return await Promise.all(sdkCiphers.map((cipher) => ciphersClient.decrypt(cipher)));
        }),
      ),
    );
  }

  /**
   * Public so callers needing a decrypted `CipherView` — `SdkFido2AuthenticatorService`, which
   * reads `counter` — do not carry a second copy of the filter rules.
   */
  async findCredentialCiphers(
    ids: Uint8Array<ArrayBuffer>[] | undefined,
    rpId: string,
  ): Promise<CipherView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const ciphers = await this.cipherService.getAllDecrypted(userId);

    return ids === undefined || ids.length === 0
      ? ciphers.filter((cipher) => this.isDiscoverablePasskeyFor(cipher, rpId))
      : ciphers.filter(
          (cipher) => this.isPasskeyFor(cipher, rpId) && this.hasAnyCredentialId(cipher, ids),
        );
  }

  /**
   * Every cipher, unfiltered — the SDK does its own passkey filtering on the result. Converting
   * through the SDK is forced: `CipherListView` only comes out of `decrypt_list`.
   */
  async all_credentials(): Promise<CipherListView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const ciphers = await firstValueFrom(
      this.cipherService
        .ciphers$(userId)
        .pipe(
          map((records) => Object.values(records ?? {}).map((data) => new Cipher(data, undefined))),
        ),
    );
    const sdkCiphers = ciphers.map((cipher) => cipher.toSdkCipher());

    // The client is only valid inside the subscription — see the warning on `userClient$`.
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("Cannot list FIDO2 credentials: the SDK client is unavailable.");
          }
          using ref = sdk.take();
          return await ref.value.vault().ciphers().decrypt_list(sdkCiphers);
        }),
      ),
    );
  }

  /**
   * The SDK hands over an already-encrypted cipher, but it is decrypted and re-saved through the
   * clients write path until the key-rotation corruption investigation (PM-40277) closes.
   *
   * `lastUsedDate` is stamped here because the SDK owns neither `localData` nor the distinction
   * between the two reasons it saves: registration and a counter update after an assertion. The
   * TypeScript path stamps only on assertion (`fido2-authenticator.service.ts`), so a newly
   * registered passkey gets a `lastUsedDate` it would not have had — it was just used to register,
   * and the alternative is counter-bearing passkeys never refreshing theirs.
   */
  async save_credential(cred: EncryptionContext): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const encrypted = Cipher.fromSdkCipher(cred.cipher);
    if (encrypted === undefined) {
      throw new Error("Cannot save FIDO2 credential: the SDK returned an unreadable cipher.");
    }

    const decrypted = await this.cipherService.decrypt(encrypted, userId);
    decrypted.localData = { ...decrypted.localData, lastUsedDate: new Date().getTime() };

    await this.cipherService.updateWithServer(decrypted, userId);
  }

  /** The rule shared by both lookups: a live, passkey-bearing login for this relying party. */
  private isPasskeyFor(cipher: CipherView, rpId: string): boolean {
    return (
      !cipher.isDeleted &&
      cipher.type === CipherType.Login &&
      cipher.login.hasFido2Credentials &&
      // Only the first credential is consulted, matching the TypeScript path.
      cipher.login.fido2Credentials[0].rpId === rpId
    );
  }

  private isDiscoverablePasskeyFor(cipher: CipherView, rpId: string): boolean {
    return this.isPasskeyFor(cipher, rpId) && cipher.login.fido2Credentials[0].discoverable;
  }

  private hasAnyCredentialId(cipher: CipherView, ids: Uint8Array<ArrayBuffer>[]): boolean {
    // One bad stored id must not fail the whole lookup.
    const credentialId = parseCredentialId(cipher.login.fido2Credentials[0].credentialId);
    if (credentialId === undefined) {
      return false;
    }

    return ids.some((id) => compareCredentialIds(id, credentialId));
  }
}
