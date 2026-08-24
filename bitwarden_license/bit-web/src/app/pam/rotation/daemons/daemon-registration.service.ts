import { Injectable, inject } from "@angular/core";
import { filter, firstValueFrom, map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { DaemonRegisterRequest } from "../requests/daemon-register.request";
import { DaemonRegistrationResponse } from "../responses/daemon-registration.response";
import { RotationApiService } from "../rotation-api.service";

/**
 * Handles the cryptographic registration flow for a new rotation daemon.
 *
 * Mirrors `AccessService.createAccessToken` from SM line-for-line. The only
 * differences are the key-derivation purpose string and token format:
 *
 * **Key derivation params (open contract — must match the daemon's re-derivation):**
 * - purpose: `"pam-rotation-daemon"`
 * - salt: `"bitwarden-accesstoken"`
 *
 * **Token format:**
 * `0.daemon.{apiKeyId}.{clientSecret}:{keyMaterialBase64}`
 *
 * The token is shown once in the UI and never stored server-side in recoverable
 * form. Deliver it to the daemon operator out-of-band (e.g. secure paste into the
 * daemon configuration file).
 *
 * SECURITY: never log the token, the client secret, or any key material.
 *
 * Provide at the dialog component level — see `DaemonRegisterDialogComponent`.
 */
@Injectable()
export class DaemonRegistrationService {
  private readonly keyService = inject(KeyService);
  private readonly keyGenerationService = inject(KeyGenerationService);
  private readonly encryptService = inject(EncryptService);
  private readonly accountService = inject(AccountService);
  private readonly rotationApi = inject(RotationApiService);

  private getOrganizationKey$(organizationId: OrganizationId) {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.keyService.orgKeys$(userId)),
      filter((orgKeys) => !!orgKeys),
      map((organizationKeysById) => organizationKeysById[organizationId]),
    );
  }

  private async getOrganizationKey(organizationId: OrganizationId): Promise<SymmetricCryptoKey> {
    return await firstValueFrom(this.getOrganizationKey$(organizationId));
  }

  /**
   * Registers a new daemon for the given organization.
   *
   * 1. Derives a 128-bit local key with purpose `"pam-rotation-daemon"` / salt `"bitwarden-accesstoken"`.
   * 2. Encrypts the org key material with the derived key (`encryptedPayload`).
   * 3. Wraps the derived key with the org key (`key`).
   * 4. POSTs to the server with the daemon name (plaintext) + both ciphertexts.
   * 5. Assembles the one-time token from the server response + local key material.
   *
   * @returns The assembled token (shown once) and the registration response (for list refresh).
   */
  async register(
    organizationId: OrganizationId,
    name: string,
  ): Promise<{ token: string; daemon: DaemonRegistrationResponse }> {
    const key = await this.keyGenerationService.createKeyWithPurpose(
      128,
      "pam-rotation-daemon",
      "bitwarden-accesstoken",
    );

    const orgKey = await this.getOrganizationKey(organizationId);

    const [encryptedPayload, wrappedKey] = await Promise.all([
      this.encryptService.encryptString(
        JSON.stringify({ encryptionKey: orgKey.keyB64 }),
        key.derivedKey,
      ),
      this.encryptService.encryptString(key.derivedKey.keyB64, orgKey),
    ]);

    const daemon = await this.rotationApi.registerRotationDaemon(
      organizationId,
      new DaemonRegisterRequest({ name, encryptedPayload, key: wrappedKey }),
    );

    // SECURITY: never log this token.
    const token = `0.daemon.${daemon.apiKeyId}.${daemon.clientSecret}:${Utils.fromBufferToB64(key.material)}`;

    return { token, daemon };
  }
}
