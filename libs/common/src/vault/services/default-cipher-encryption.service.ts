import { EMPTY, catchError, firstValueFrom, map } from "rxjs";

import { KeyService } from "@bitwarden/key-management";
import { CipherListView } from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { LogService } from "../../platform/abstractions/log.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { EncArrayBuffer } from "../../platform/models/domain/enc-array-buffer";
import { OrganizationId, UserId } from "../../types/guid";
import { OrgKey } from "../../types/key";
import { CipherEncryptionService } from "../abstractions/cipher-encryption.service";
import { CipherType } from "../enums";
import { Cipher } from "../models/domain/cipher";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { Fido2CredentialView } from "../models/view/fido2-credential.view";
import { filterOutNullish } from "../utils/observable-utilities";

export class DefaultCipherEncryptionService implements CipherEncryptionService {
  constructor(
    private sdkService: SdkService,
    private configService: ConfigService,
    private logService: LogService,
    private encryptService: EncryptService,
    private keyService: KeyService,
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

  async getDecryptedAttachmentBuffer(
    cipher: Cipher,
    attachment: AttachmentView,
    response: Response,
    userId: UserId,
  ): Promise<Uint8Array | null> {
    const useSdkDecryption = await this.configService.getFeatureFlag(
      FeatureFlag.PM19941MigrateCipherDomainToSdk,
    );

    if (useSdkDecryption) {
      const encryptedContent = await response.arrayBuffer();
      return this.decryptAttachmentContent(
        cipher,
        attachment,
        new Uint8Array(encryptedContent),
        userId,
      );
    }

    const encBuf = await EncArrayBuffer.fromResponse(response);
    const key =
      attachment.key != null
        ? attachment.key
        : await firstValueFrom(
            this.keyService.orgKeys$(userId).pipe(
              filterOutNullish(),
              map((orgKeys) => orgKeys[cipher.organizationId as OrganizationId] as OrgKey),
            ),
          );
    return await this.encryptService.decryptToBytes(encBuf, key);
  }

  /**
   * Decrypts the content of an attachment using the sdk.
   */
  private async decryptAttachmentContent(
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
