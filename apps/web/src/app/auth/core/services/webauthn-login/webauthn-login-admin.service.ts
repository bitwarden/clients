// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable, Optional } from "@angular/core";
import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  from,
  map,
  Observable,
  shareReplay,
  switchMap,
  tap,
} from "rxjs";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { WebauthnRotateCredentialRequest } from "@bitwarden/common/auth/models/request/webauthn-rotate-credential.request";
import { WebAuthnLoginCredentialAssertionOptionsView } from "@bitwarden/common/auth/models/view/webauthn-login/webauthn-login-credential-assertion-options.view";
import { WebAuthnLoginCredentialAssertionView } from "@bitwarden/common/auth/models/view/webauthn-login/webauthn-login-credential-assertion.view";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { PrfKeySet } from "@bitwarden/common/key-management/keys/models/rotateable-key-set";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService, UserKeyRotationDataProvider } from "@bitwarden/key-management";

import { RotateableKeySetService } from "../../../../key-management/services/rotateable-key-set.service";
import { CredentialCreateOptionsView } from "../../views/credential-create-options.view";
import { PendingWebauthnLoginCredentialView } from "../../views/pending-webauthn-login-credential.view";
import { WebauthnLoginCredentialView } from "../../views/webauthn-login-credential.view";

import { EnableCredentialEncryptionRequest } from "./request/enable-credential-encryption.request";
import { SaveCredentialRequest } from "./request/save-credential.request";
import { WebauthnLoginAttestationResponseRequest } from "./request/webauthn-login-attestation-response.request";
import { WebAuthnLoginAdminApiService } from "./webauthn-login-admin-api.service";

@Injectable({ providedIn: "root" })
/**
 * Service for managing WebAuthnLogin credentials.
 */
export class WebauthnLoginAdminService
  implements UserKeyRotationDataProvider<WebauthnRotateCredentialRequest>
{
  static readonly MaxCredentialCount = 5;

  private navigatorCredentials: CredentialsContainer;
  private _refresh$ = new BehaviorSubject<void>(undefined);
  private _loading$ = new BehaviorSubject<boolean>(true);
  private readonly credentials$ = this._refresh$.pipe(
    tap(() => this._loading$.next(true)),
    switchMap(() => this.fetchCredentials$()),
    tap(() => this._loading$.next(false)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * An Observable that emits a boolean indicating whether the service is currently fetching
   * WebAuthnLogin credentials from the server.
   */
  readonly loading$ = this._loading$.asObservable();

  constructor(
    private apiService: WebAuthnLoginAdminApiService,
    private userVerificationService: UserVerificationService,
    private rotateableKeySetService: RotateableKeySetService,
    private webAuthnLoginPrfKeyService: WebAuthnLoginPrfKeyServiceAbstraction,
    private keyService: KeyService,
    @Optional() navigatorCredentials?: CredentialsContainer,
    @Optional() private logService?: LogService,
  ) {
    // Default parameters don't work when used with Angular DI
    this.navigatorCredentials = navigatorCredentials ?? navigator.credentials;
  }

  /**
   * Get the credential assertion options needed for initiating the WebAuthnLogin credential update process.
   * The options contains assertion options and other data for the authenticator.
   * This method requires user verification.
   *
   * @param verification User verification data to be used for the request.
   * @returns The credential assertion options and a token to be used for the credential update request.
   */
  async getCredentialAssertOptions(
    verification: Verification,
  ): Promise<WebAuthnLoginCredentialAssertionOptionsView> {
    const request = await this.userVerificationService.buildRequest(verification);
    const response = await this.apiService.getCredentialAssertionOptions(request);
    return new WebAuthnLoginCredentialAssertionOptionsView(response.options, response.token);
  }

  /**
   * Get the credential attestation options needed for initiating the WebAuthnLogin credential creation process.
   * The options contains a challenge and other data for the authenticator.
   * This method requires user verification.
   *
   * @param verification User verification data to be used for the request.
   * @returns The credential attestation options and a token to be used for the credential creation request.
   */

  async getCredentialAttestationOptions(
    verification: Verification,
  ): Promise<CredentialCreateOptionsView> {
    const request = await this.userVerificationService.buildRequest(verification);
    const response = await this.apiService.getCredentialCreateOptions(request);
    return new CredentialCreateOptionsView(response.options, response.token);
  }

  /**
   * Create a credential using the given options. This triggers the browsers WebAuthn API to create a credential.
   *
   * @param credentialOptions Options received from the server using `getCredentialCreateOptions`.
   * @returns A pending credential that can be saved to server directly or be used to create a key set.
   */
  async createCredential(
    credentialOptions: CredentialCreateOptionsView,
  ): Promise<PendingWebauthnLoginCredentialView | undefined> {
    const nativeOptions: CredentialCreationOptions = {
      publicKey: credentialOptions.options,
    };
    // TODO: Remove `any` when typescript typings add support for PRF
    nativeOptions.publicKey.extensions = {
      prf: {},
    } as any;

    try {
      const response = await this.navigatorCredentials.create(nativeOptions);
      if (!(response instanceof PublicKeyCredential)) {
        return undefined;
      }
      // TODO: Remove `any` when typescript typings add support for PRF
      const supportsPrf = Boolean((response.getClientExtensionResults() as any).prf?.enabled);
      return new PendingWebauthnLoginCredentialView(credentialOptions, response, supportsPrf);
    } catch (error) {
      this.logService?.error(error);
      return undefined;
    }
  }

  /**
   * Create a key set from the given pending credential. The credential must support PRF.
   * This will trigger the browsers WebAuthn API to generate a PRF-output.
   *
   * @param pendingCredential A credential created using `createCredential`.
   * @param userId The target users id.
   * @returns A key set that can be saved to the server. Undefined is returned if the credential doesn't support PRF.
   */
  async createKeySet(
    pendingCredential: PendingWebauthnLoginCredentialView,
    userId: UserId,
  ): Promise<PrfKeySet | undefined> {
    const nativeOptions: CredentialRequestOptions = {
      publicKey: {
        challenge: pendingCredential.createOptions.options.challenge,
        allowCredentials: [{ id: pendingCredential.deviceResponse.rawId, type: "public-key" }],
        rpId: pendingCredential.createOptions.options.rp.id,
        timeout: pendingCredential.createOptions.options.timeout,
        userVerification:
          pendingCredential.createOptions.options.authenticatorSelection.userVerification,
        // TODO: Remove `any` when typescript typings add support for PRF
        extensions: {
          prf: { eval: { first: await this.webAuthnLoginPrfKeyService.getLoginWithPrfSalt() } },
        } as any,
      },
    };

    try {
      const response = await this.navigatorCredentials.get(nativeOptions);
      if (!(response instanceof PublicKeyCredential)) {
        return undefined;
      }

      // TODO: Remove `any` when typescript typings add support for PRF
      const prfResult = (response.getClientExtensionResults() as any).prf?.results?.first;

      if (prfResult === undefined) {
        return undefined;
      }

      const symmetricPrfKey =
        await this.webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf(prfResult);
      const userKey = await firstValueFrom(this.keyService.userKey$(userId));
      return await this.rotateableKeySetService.createKeySet(userKey, symmetricPrfKey);
    } catch (error) {
      this.logService?.error(error);
      return undefined;
    }
  }

  /**
   * Save a pending credential to the server. This will also save the key set if it is provided.
   *
   * @param name User provided name for the credential.
   * @param credential A pending credential created using `createCredential`.
   * @param prfKeySet A key set created using `createKeySet`.
   */
  async saveCredential(
    name: string,
    credential: PendingWebauthnLoginCredentialView,
    prfKeySet?: PrfKeySet,
  ) {
    const request = new SaveCredentialRequest();
    request.deviceResponse = new WebauthnLoginAttestationResponseRequest(credential.deviceResponse);
    request.token = credential.createOptions.token;
    request.name = name;
    request.supportsPrf = credential.supportsPrf;
    request.encryptedUserKey = prfKeySet?.encryptedRotateableKey.encryptedString;
    request.encryptedPublicKey = prfKeySet?.encryptedPublicKey.encryptedString;
    request.encryptedPrivateKey = prfKeySet?.encryptedPrivateKey.encryptedString;
    await this.apiService.saveCredential(request);
    this.refresh();
  }

  /**
   * Enable encryption for a credential that has already been saved to the server.
   * This will update the KeySet associated with the credential in the database.
   * We short circuit the process here incase the WebAuthnLoginCredential doesn't support PRF or
   * if there was a problem with the Credential Assertion.
   *
   * @param assertionOptions Options received from the server using `getCredentialAssertOptions`.
   * @param userId  The target users id.
   * @returns void
   */
  async enableCredentialEncryption(
    assertionOptions: WebAuthnLoginCredentialAssertionView,
    userId: UserId,
  ): Promise<void> {
    if (assertionOptions === undefined || assertionOptions?.prfKey === undefined) {
      throw new Error("invalid credential");
    }
    if (!userId) {
      throw new Error("userId is required");
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    const prfKeySet: PrfKeySet = await this.rotateableKeySetService.createKeySet(
      userKey,
      assertionOptions.prfKey,
    );

    const request = new EnableCredentialEncryptionRequest();
    request.token = assertionOptions.token;
    request.deviceResponse = assertionOptions.deviceResponse;
    request.encryptedUserKey = prfKeySet.encryptedRotateableKey.encryptedString;
    request.encryptedPublicKey = prfKeySet.encryptedPublicKey.encryptedString;
    request.encryptedPrivateKey = prfKeySet.encryptedPrivateKey.encryptedString;
    await this.apiService.updateCredential(request);
    this.refresh();
  }

  /**
   * List of webauthn credentials saved on the server.
   *
   * **Note:**
   *   - Subscribing might trigger a network request if the credentials haven't been fetched yet.
   *   - The observable is shared and will not create unnecessary duplicate requests.
   *   - The observable will automatically re-fetch if the user adds or removes a credential.
   *   - The observable is lazy and will only fetch credentials when subscribed to.
   *   - Don't subscribe to this in the constructor of a long-running service, as it will keep the observable alive.
   */
  getCredentials$(): Observable<WebauthnLoginCredentialView[]> {
    return this.credentials$;
  }

  /**
   * Subscribe to a single credential by id.
   *
   * @param credentialId The id of the credential to subscribe to.
   * @returns An observable that emits the credential with the given id.
   */
  getCredential$(credentialId: string): Observable<WebauthnLoginCredentialView> {
    return this.credentials$.pipe(
      map((credentials) => credentials.find((c) => c.id === credentialId)),
      filter((c) => c !== undefined),
    );
  }

  /**
   * Delete a credential from the server. This method requires user verification.
   *
   * @param credentialId The id of the credential to delete.
   * @param verification User verification data to be used for the request.
   * @returns A promise that resolves when the credential has been deleted.
   */
  async deleteCredential(credentialId: string, verification: Verification): Promise<void> {
    const request = await this.userVerificationService.buildRequest(verification);
    await this.apiService.deleteCredential(credentialId, request);
    this.refresh();
  }

  private fetchCredentials$(): Observable<WebauthnLoginCredentialView[]> {
    return from(this.apiService.getCredentials()).pipe(
      map((response) =>
        response.data.map(
          (credential) =>
            new WebauthnLoginCredentialView(credential.id, credential.name, credential.prfStatus),
        ),
      ),
    );
  }

  private refresh() {
    this._refresh$.next();
  }

  /**
   * Creates rotate credential requests for the purpose of user key rotation.
   * This works by fetching the current webauthn credentials, filtering out the ones that have a PRF keyset,
   * and rotating these using the rotateable key set service.
   *
   * @param oldUserKey The old user key
   * @param newUserKey The new user key
   * @param userId The user id
   * @returns A promise that returns an array of rotate credential requests when resolved.
   */
  async getRotatedData(
    oldUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<WebauthnRotateCredentialRequest[]> {
    if (!oldUserKey) {
      throw new Error("oldUserKey is required");
    }
    if (!newUserKey) {
      throw new Error("newUserKey is required");
    }

    return Promise.all(
      (await this.apiService.getCredentials()).data
        .filter((credential) => credential.hasPrfKeyset())
        .map(async (response) => {
          const keyset = response.getRotateableKeyset();
          const rotatedKeyset = await this.rotateableKeySetService.rotateKeySet(
            keyset,
            oldUserKey,
            newUserKey,
          );
          const request = new WebauthnRotateCredentialRequest(
            response.id,
            rotatedKeyset.encryptedPublicKey,
            rotatedKeyset.encryptedRotateableKey,
          );
          return request;
        }),
    );
  }
}
