import { EMPTY, catchError, firstValueFrom, map, of } from "rxjs";

import { CipherListView } from "@bitwarden/sdk-internal";

import { LogService } from "../../platform/abstractions/log.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { CipherEncryptionService } from "../abstractions/cipher-encryption.service";
import { CipherType } from "../enums";
import { Cipher } from "../models/domain/cipher";
import { CipherView } from "../models/view/cipher.view";
import { Fido2CredentialView } from "../models/view/fido2-credential.view";

export class DefaultCipherEncryptionService implements CipherEncryptionService {
  constructor(
    private sdkService: SdkService,
    private logService: LogService,
  ) {}

  /**
   * {@inheritdoc}
   */
  async decrypt(cipher: Cipher, userId: UserId): Promise<CipherView> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          const sdkCipherView = ref.value.vault().ciphers().decrypt(cipher.toSdkCipher());
          // The SDK returns a cipherView or throws an error if decryption fails.
          const clientCipherView = CipherView.fromSdkCipherView(sdkCipherView)!;

          // Decrypt Fido2 credentials if available
          if (
            clientCipherView.type === CipherType.Login &&
            sdkCipherView.login?.fido2Credentials?.length
          ) {
            const fido2CredentialViews = ref.value
              .vault()
              .ciphers()
              .decrypt_fido2_credentials(sdkCipherView);

            clientCipherView.login.fido2Credentials = fido2CredentialViews
              .map((f) => Fido2CredentialView.fromSdkFido2CredentialView(f))
              .filter((view): view is Fido2CredentialView => view !== undefined);
          }

          return clientCipherView;
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt cipher ${cipher.id}: ${error}`);

          // Return failed cipher view
          const failedView = new CipherView(cipher);
          failedView.decryptionFailure = true;
          failedView.name = "[error: cannot decrypt]";

          return of(failedView);
        }),
      ),
    );
  }

  /**
   * {@inheritdoc}
   */
  async decryptCipherList(ciphers: Cipher[], userId: UserId): Promise<CipherListView[]> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK is undefined");
          }

          using ref = sdk.take();

          return ref.value
            .vault()
            .ciphers()
            .decrypt_list(ciphers.map((cipher) => cipher.toSdkCipher()));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt cipher list: ${error}`);
          return EMPTY;
        }),
      ),
    );
  }
}
