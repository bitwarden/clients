import { firstValueFrom, switchMap, catchError } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherView as SdkCipherView } from "@bitwarden/sdk-internal";

import { CipherSdkService } from "../abstractions/cipher-sdk.service";

export class DefaultCipherSdkService implements CipherSdkService {
  constructor(
    private sdkService: SdkService,
    private logService: LogService,
  ) {}

  async createWithServer(
    cipherView: CipherView,
    userId: UserId,
    orgAdmin?: boolean,
  ): Promise<CipherView | undefined> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          const sdkCreateRequest = cipherView.toSdkCreateCipherRequest();
          let result: SdkCipherView;
          if (orgAdmin) {
            result = await ref.value.vault().ciphers().admin().create(sdkCreateRequest);
          } else {
            result = await ref.value.vault().ciphers().create(sdkCreateRequest);
          }
          return CipherView.fromSdkCipherView(result);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to create cipher: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async updateWithServer(
    cipher: CipherView,
    userId: UserId,
    originalCipherView?: CipherView,
    orgAdmin?: boolean,
  ): Promise<CipherView | undefined> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          const sdkUpdateRequest = cipher.toSdkUpdateCipherRequest();
          let result: SdkCipherView;
          if (orgAdmin) {
            result = await ref.value
              .vault()
              .ciphers()
              .admin()
              .edit(
                sdkUpdateRequest,
                originalCipherView?.toSdkCipherView() || new CipherView().toSdkCipherView(),
              );
          } else {
            result = await ref.value.vault().ciphers().edit(sdkUpdateRequest);
          }
          return CipherView.fromSdkCipherView(result);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to update cipher: ${error}`);
          throw error;
        }),
      ),
    );
  }
}
