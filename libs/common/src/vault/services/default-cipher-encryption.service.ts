import { EMPTY, catchError, firstValueFrom, map } from "rxjs";

import { CipherListView } from "@bitwarden/sdk-internal";

import { LogService } from "../../platform/abstractions/log.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { CipherEncryptionService } from "../abstractions/cipher-encryption.service";
import { CipherType } from "../enums";
import { Cipher } from "../models/domain/cipher";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { Fido2CredentialView } from "../models/view/fido2-credential.view";

export class DefaultCipherEncryptionService implements CipherEncryptionService {
  constructor(
    private sdkService: SdkService,
    private logService: LogService,
  ) {}

  async decrypt(cipher: Cipher, userId: UserId): Promise<CipherView> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          const sdkCipherView = ref.value.vault().ciphers().decrypt(cipher.toSdkCipher());

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

            // TEMPORARY: Manually decrypt the keyValue for Fido2 credentials
            // since we don't currently use the SDK for Fido2 Authentication.
            const decryptedKeyValue = ref.value
              .vault()
              .ciphers()
              .decrypt_fido2_private_key(sdkCipherView);

            clientCipherView.login.fido2Credentials = fido2CredentialViews
              .map((f) => {
                const view = Fido2CredentialView.fromSdkFido2CredentialView(f)!;

                return {
                  ...view,
                  keyValue: decryptedKeyValue,
                };
              })
              .filter((view): view is Fido2CredentialView => view !== undefined);
          }

          return clientCipherView;
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt cipher ${error}`);
          return EMPTY;
        }),
      ),
    );
  }

  decryptManyLegacy(ciphers: Cipher[], userId: UserId): Promise<CipherView[]> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          return ciphers.map((cipher) => {
            const sdkCipherView = ref.value.vault().ciphers().decrypt(cipher.toSdkCipher());
            const clientCipherView = CipherView.fromSdkCipherView(sdkCipherView)!;

            // Handle FIDO2 credentials if present
            if (
              clientCipherView.type === CipherType.Login &&
              sdkCipherView.login?.fido2Credentials?.length
            ) {
              const fido2CredentialViews = ref.value
                .vault()
                .ciphers()
                .decrypt_fido2_credentials(sdkCipherView);

              // TODO (PM-21259): Remove manual keyValue decryption for FIDO2 credentials.
              // This is a temporary workaround until we can use the SDK for FIDO2 authentication.
              const decryptedKeyValue = ref.value
                .vault()
                .ciphers()
                .decrypt_fido2_private_key(sdkCipherView);

              clientCipherView.login.fido2Credentials = fido2CredentialViews
                .map((f) => {
                  const view = Fido2CredentialView.fromSdkFido2CredentialView(f)!;
                  return {
                    ...view,
                    keyValue: decryptedKeyValue,
                  };
                })
                .filter((view): view is Fido2CredentialView => view !== undefined);
            }

            return clientCipherView;
          });
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt ciphers: ${error}`);
          return EMPTY;
        }),
      ),
    );
  }

  async decryptMany(ciphers: Cipher[], userId: UserId): Promise<CipherListView[]> {
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

  /**
   * Decrypts an attachment's content from a response object.
   *
   * @param cipher The encrypted cipher object that owns the attachment
   * @param attachment The encrypted attachment object
   * @param encryptedContent The encrypted content as a Uint8Array
   * @param userId The user ID whose key will be used for decryption
   *
   * @returns A promise that resolves to the decrypted content
   */
  async decryptAttachmentContent(
    cipher: Cipher,
    attachment: AttachmentView,
    encryptedContent: Uint8Array,
    userId: UserId,
  ): Promise<Uint8Array> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK is undefined");
          }

          using ref = sdk.take();

          return ref.value
            .vault()
            .attachments()
            .decrypt_buffer(
              cipher.toSdkCipher(),
              attachment.toSdkAttachmentView(),
              encryptedContent,
            );
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt cipher buffer: ${error}`);
          return EMPTY;
        }),
      ),
    );
  }
}
