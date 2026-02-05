import { firstValueFrom, switchMap, catchError } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService, asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
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

          // Create the request
          const sdkCreateRequest = cipherView.toSdkCreateCipherRequest();

          // Handle FIDO2 credentials encryption if present
          if (
            cipherView.type === CipherType.Login &&
            cipherView.login?.hasFido2Credentials &&
            "login" in sdkCreateRequest.type
          ) {
            // Convert to SDK cipher view and encrypt FIDO2 credentials
            let sdkCipherView = cipherView.toSdkCipherView();
            const fido2Credentials = cipherView.login.fido2Credentials?.map((f) =>
              f.toSdkFido2CredentialFullView(),
            );
            sdkCipherView = ref.value
              .vault()
              .ciphers()
              .set_fido2_credentials(sdkCipherView, fido2Credentials);

            // Update the request with encrypted FIDO2 credentials
            sdkCreateRequest.type.login.fido2Credentials = sdkCipherView.login?.fido2Credentials;
          }

          let result: SdkCipherView;
          if (orgAdmin) {
            result = await ref.value.vault().ciphers().admin().create(sdkCreateRequest);
          } else {
            result = await ref.value.vault().ciphers().create(sdkCreateRequest);
          }

          const clientCipherView = CipherView.fromSdkCipherView(result)!;

          // Decrypt FIDO2 credentials from response if present
          if (
            clientCipherView.type === CipherType.Login &&
            result.login?.fido2Credentials?.length
          ) {
            const fido2CredentialViews = ref.value
              .vault()
              .ciphers()
              .decrypt_fido2_credentials(result);

            const decryptedKeyValue = ref.value.vault().ciphers().decrypt_fido2_private_key(result);

            clientCipherView.login.fido2Credentials = fido2CredentialViews
              .map((f) => {
                const view = Fido2CredentialView.fromSdkFido2CredentialView(f)!;
                view.keyValue = decryptedKeyValue;
                return view;
              })
              .filter((view): view is Fido2CredentialView => view !== undefined);
          }

          return clientCipherView;
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

          // Create the update request
          const sdkUpdateRequest = cipher.toSdkUpdateCipherRequest();

          // Handle FIDO2 credentials encryption if present
          if (
            cipher.type === CipherType.Login &&
            cipher.login?.hasFido2Credentials &&
            "login" in sdkUpdateRequest.type
          ) {
            // Convert to SDK cipher view and encrypt FIDO2 credentials
            let sdkCipherView = cipher.toSdkCipherView();
            const fido2Credentials = cipher.login.fido2Credentials?.map((f) =>
              f.toSdkFido2CredentialFullView(),
            );
            sdkCipherView = ref.value
              .vault()
              .ciphers()
              .set_fido2_credentials(sdkCipherView, fido2Credentials);

            // Update the request with encrypted FIDO2 credentials
            sdkUpdateRequest.type.login.fido2Credentials = sdkCipherView.login?.fido2Credentials;
          }

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

          const clientCipherView = CipherView.fromSdkCipherView(result)!;

          // Decrypt FIDO2 credentials from response if present
          if (
            clientCipherView.type === CipherType.Login &&
            result.login?.fido2Credentials?.length
          ) {
            const fido2CredentialViews = ref.value
              .vault()
              .ciphers()
              .decrypt_fido2_credentials(result);

            const decryptedKeyValue = ref.value.vault().ciphers().decrypt_fido2_private_key(result);

            clientCipherView.login.fido2Credentials = fido2CredentialViews
              .map((f) => {
                const view = Fido2CredentialView.fromSdkFido2CredentialView(f)!;
                view.keyValue = decryptedKeyValue;
                return view;
              })
              .filter((view): view is Fido2CredentialView => view !== undefined);
          }

          return clientCipherView;
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to update cipher: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async deleteWithServer(id: string, userId: UserId, asAdmin = false): Promise<void> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          if (asAdmin) {
            await ref.value.vault().ciphers().admin().delete(asUuid(id));
          } else {
            await ref.value.vault().ciphers().delete(asUuid(id));
          }
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to delete cipher: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async deleteManyWithServer(
    ids: string[],
    userId: UserId,
    asAdmin = false,
    orgId?: OrganizationId,
  ): Promise<void> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          if (asAdmin) {
            if (orgId == null) {
              throw new Error("Organization ID is required for admin delete.");
            }
            await ref.value
              .vault()
              .ciphers()
              .admin()
              .delete_many(
                ids.map((id) => asUuid(id)),
                asUuid(orgId),
              );
          } else {
            await ref.value
              .vault()
              .ciphers()
              .delete_many(ids.map((id) => asUuid(id)));
          }
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to delete multiple ciphers: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async softDeleteWithServer(id: string, userId: UserId, asAdmin = false): Promise<void> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          if (asAdmin) {
            await ref.value.vault().ciphers().admin().soft_delete(asUuid(id));
          } else {
            await ref.value.vault().ciphers().soft_delete(asUuid(id));
          }
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to soft delete cipher: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async softDeleteManyWithServer(
    ids: string[],
    userId: UserId,
    asAdmin = false,
    orgId?: OrganizationId,
  ): Promise<void> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          if (asAdmin) {
            if (orgId == null) {
              throw new Error("Organization ID is required for admin soft delete.");
            }
            await ref.value
              .vault()
              .ciphers()
              .admin()
              .soft_delete_many(
                ids.map((id) => asUuid(id)),
                asUuid(orgId),
              );
          } else {
            await ref.value
              .vault()
              .ciphers()
              .soft_delete_many(ids.map((id) => asUuid(id)));
          }
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to soft delete multiple ciphers: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async restoreWithServer(id: string, userId: UserId, asAdmin = false): Promise<void> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          if (asAdmin) {
            await ref.value.vault().ciphers().admin().restore(asUuid(id));
          } else {
            await ref.value.vault().ciphers().restore(asUuid(id));
          }
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to restore cipher: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async restoreManyWithServer(ids: string[], userId: UserId, orgId?: string): Promise<void> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();

          // No longer using an asAdmin Param. Org Vault bulkRestore will assess if an item is unassigned or editable
          // The Org Vault will pass those ids an array as well as the orgId when calling bulkRestore
          if (orgId) {
            await ref.value
              .vault()
              .ciphers()
              .admin()
              .restore_many(
                ids.map((id) => asUuid(id)),
                asUuid(orgId),
              );
          } else {
            await ref.value
              .vault()
              .ciphers()
              .restore_many(ids.map((id) => asUuid(id)));
          }
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to restore multiple ciphers: ${error}`);
          throw error;
        }),
      ),
    );
  }
}
