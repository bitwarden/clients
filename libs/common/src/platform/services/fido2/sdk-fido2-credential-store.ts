import { firstValueFrom, map } from "rxjs";

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
import { withSdkClient } from "./with-sdk-client";

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
   * Finds the passkey ciphers for `rp_id`, limited to `ids` when given. The user handle is ignored,
   * as in the TypeScript path, so a relying party sees the same credentials either way.
   */
  async find_credentials(
    ids: number[][] | undefined,
    rp_id: string,
    _user_handle: number[] | undefined,
  ): Promise<SdkCipherView[]> {
    const matching = await this.findCredentialCiphers(
      ids?.map((id) => new Uint8Array(id)),
      rp_id,
    );

    return await this.reReadThroughSdk(matching);
  }

  /** Returns each cipher as an SDK `CipherView`, decrypted by the SDK. */
  private async reReadThroughSdk(ciphers: CipherView[]): Promise<SdkCipherView[]> {
    if (ciphers.length === 0) {
      return [];
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const records = await firstValueFrom(this.cipherService.ciphers$(userId));

    // Not `CipherView.toSdkCipherView()`: it sets `login.fido2Credentials` to `undefined`, so every
    // cipher would reach the authenticator with no passkeys on it.
    const sdkCiphers = ciphers
      .map((cipher) => (cipher.id == null ? undefined : records?.[cipher.id as CipherId]))
      .filter((data) => data !== undefined)
      .map((data) => new Cipher(data, undefined).toSdkCipher());

    return await withSdkClient(this.sdkService, userId, async (client) => {
      const ciphersClient = client.vault().ciphers();
      return await Promise.all(sdkCiphers.map((cipher) => ciphersClient.decrypt(cipher)));
    });
  }

  /** Finds the passkey ciphers for `rpId`, limited to `ids` when given, as vault `CipherView`s. */
  async findCredentialCiphers(
    ids: Uint8Array<ArrayBuffer>[] | undefined,
    rpId: string,
  ): Promise<CipherView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const ciphers = await this.cipherService.getAllDecrypted(userId);

    const matches: (cipher: CipherView) => boolean =
      ids === undefined || ids.length === 0
        ? (cipher) => this.isDiscoverablePasskeyFor(cipher, rpId)
        : (cipher) => this.isPasskeyFor(cipher, rpId) && this.hasAnyCredentialId(cipher, ids);

    return ciphers.filter(matches);
  }

  /** Returns every cipher, unfiltered: the SDK filters for passkeys itself. */
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

    return await withSdkClient(this.sdkService, userId, (client) =>
      client.vault().ciphers().decrypt_list(sdkCiphers),
    );
  }

  /** Saves the cipher the SDK created or updated, and stamps its `localData.lastUsedDate`. */
  async save_credential(cred: EncryptionContext): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const encrypted = Cipher.fromSdkCipher(cred.cipher);
    if (encrypted === undefined) {
      throw new Error("Cannot save FIDO2 credential: the SDK returned an unreadable cipher.");
    }

    // Re-saved through the clients write path, not as the SDK encrypted it, until the key-rotation
    // corruption investigation (PM-40277) closes.
    const decrypted = await this.cipherService.decrypt(encrypted, userId);
    // The SDK doesn't say whether this save is a registration or a counter update, so the stamp is
    // unconditional. The TypeScript path stamps only on assertion.
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
    const credentialId = parseCredentialId(cipher.login.fido2Credentials[0].credentialId);
    if (credentialId === undefined) {
      return false;
    }

    return ids.some((id) => compareCredentialIds(id, credentialId));
  }
}
