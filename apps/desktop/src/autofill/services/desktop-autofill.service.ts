import { Injectable, OnDestroy } from "@angular/core";
import {
  Subject,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  mergeMap,
  switchMap,
  takeUntil,
  EMPTY,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Fido2AuthenticatorGetAssertionParams,
  Fido2AuthenticatorGetAssertionResult,
  Fido2AuthenticatorMakeCredentialResult,
  Fido2AuthenticatorMakeCredentialsParams,
  Fido2AuthenticatorService as Fido2AuthenticatorServiceAbstraction,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-authenticator.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { parseCredentialId } from "@bitwarden/common/platform/services/fido2/credential-id-utils";
import { getCredentialsForAutofill } from "@bitwarden/common/platform/services/fido2/fido2-autofill-utils";
import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { autofill } from "@bitwarden/desktop-napi";

import { NativeAutofillStatusCommand } from "../../platform/main/autofill/status.command";
import {
  NativeAutofillFido2Credential,
  NativeAutofillPasswordCredential,
  NativeAutofillSyncCommand,
} from "../../platform/main/autofill/sync.command";

import type { NativeWindowObject } from "./desktop-fido2-user-interface.service";

@Injectable()
export class DesktopAutofillService implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private logService: LogService,
    private cipherService: CipherService,
    private configService: ConfigService,
    private fido2AuthenticatorService: Fido2AuthenticatorServiceAbstraction<NativeWindowObject>,
    private accountService: AccountService,
  ) {}

  async init() {
    this.configService
      .getFeatureFlag$(FeatureFlag.MacOsNativeCredentialSync)
      .pipe(
        distinctUntilChanged(),
        switchMap((enabled) => {
          return this.accountService.activeAccount$.pipe(
            map((account) => account?.id),
            filter((userId): userId is UserId => userId != null),
            switchMap((userId) => this.cipherService.cipherViews$(userId)),
          );
        }),
        // TODO: This will unset all the autofill credentials on the OS
        // when the account locks. We should instead explicilty clear the credentials
        // when the user logs out. Maybe by subscribing to the encrypted ciphers observable instead.
        mergeMap((cipherViewMap) => this.sync(Object.values(cipherViewMap ?? []))),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.listenIpc();
  }

  /** Give metadata about all available credentials in the users vault */
  async sync(cipherViews: CipherView[]) {
    this.logService.info("Syncing autofill credentials: ", cipherViews.length);
    // const status = await this.status();
    // if (status.type === "error") {
    //   return this.logService.error("Error getting autofill status", status.error);
    // }

    // if (!status.value.state.enabled) {
    //   // Autofill is disabled
    //   return;
    // }

    let fido2Credentials: NativeAutofillFido2Credential[];
    let passwordCredentials: NativeAutofillPasswordCredential[] = [];

    fido2Credentials = (await getCredentialsForAutofill(cipherViews)).map((credential) => ({
      type: "fido2",
      ...credential,
    }));

    // Mock a couple of passkeys for testing purposes
    fido2Credentials.push({
      type: "fido2",
      cipherId: "mock-cipher-id-1",
      credentialId: "passkey1",
      rpId: "webauthn.io",
      userHandle: "passkey1",
      userName: "Mock passkey1",
    });
    fido2Credentials.push({
      type: "fido2",
      cipherId: "mock-cipher-id-2",
      credentialId: "passkey2",
      rpId: "webauthn.io",
      userHandle: "passkey2",
      userName: "Mock passkey2",
    });

    this.logService.info("Found FIDO2 credentials", fido2Credentials.length);

    const syncResult = await ipc.autofill.runCommand<NativeAutofillSyncCommand>({
      namespace: "autofill",
      command: "sync",
      params: {
        credentials: [...fido2Credentials, ...passwordCredentials],
      },
    });

    if (syncResult.type === "error") {
      return this.logService.error("Error syncing autofill credentials", syncResult.error);
    }

    this.logService.debug(`Synced ${syncResult.value.added} autofill credentials`);
  }

  /** Get autofill status from OS */
  private status() {
    // TODO: Investigate why this type needs to be explicitly set
    return ipc.autofill.runCommand<NativeAutofillStatusCommand>({
      namespace: "autofill",
      command: "status",
      params: {},
    });
  }

  listenIpc() {
    ipc.autofill.listenPasskeyRegistration((clientId, sequenceNumber, request, callback) => {
      this.logService.warning("listenPasskeyRegistration", clientId, sequenceNumber, request);
      this.logService.warning(
        "listenPasskeyRegistration2",
        this.convertRegistrationRequest(request),
      );

      const controller = new AbortController();
      void this.fido2AuthenticatorService
        .makeCredential(
          this.convertRegistrationRequest(request),
          { windowXy: request.windowXy },
          controller,
        )
        .then((response) => {
          callback(null, this.convertRegistrationResponse(request, response));
        })
        .catch((error) => {
          this.logService.error("listenPasskeyRegistration error", error);
          callback(error, null);
        });
    });

    ipc.autofill.listenPasskeyAssertionWithoutUserInterface(
      async (clientId, sequenceNumber, request, callback) => {
        this.logService.warning(
          "listenPasskeyAssertion without user interface",
          clientId,
          sequenceNumber,
          request,
        );

        // For some reason the credentialId is passed as an empty array in the request, so we need to
        // get it from the cipher. For that we use the recordIdentifier, which is the cipherId.
        if (request.recordIdentifier && request.credentialId.length === 0) {
          const activeUserId = await firstValueFrom(
            this.accountService.activeAccount$.pipe(getOptionalUserId),
          );
          if (!activeUserId) {
            this.logService.error("listenPasskeyAssertion error", "Active user not found");
            callback(new Error("Active user not found"), null);
            return;
          }

          const cipher = await this.cipherService.get(request.recordIdentifier, activeUserId);
          if (!cipher) {
            this.logService.error("listenPasskeyAssertion error", "Cipher not found");
            callback(new Error("Cipher not found"), null);
            return;
          }

          const decrypted = await this.cipherService.decrypt(cipher, activeUserId);

          const fido2Credential = decrypted.login.fido2Credentials?.[0];
          if (!fido2Credential) {
            this.logService.error("listenPasskeyAssertion error", "Fido2Credential not found");
            callback(new Error("Fido2Credential not found"), null);
            return;
          }

          request.credentialId = Array.from(
            new Uint8Array(parseCredentialId(decrypted.login.fido2Credentials?.[0].credentialId)),
          );
        }

        const controller = new AbortController();
        void this.fido2AuthenticatorService
          .getAssertion(
            this.convertAssertionRequest(request),
            { windowXy: request.windowXy },
            controller,
          )
          .then((response) => {
            callback(null, this.convertAssertionResponse(request, response));
          })
          .catch((error) => {
            this.logService.error("listenPasskeyAssertion error", error);
            callback(error, null);
          });
      },
    );

    ipc.autofill.listenPasskeyAssertion(async (clientId, sequenceNumber, request, callback) => {
      this.logService.warning("listenPasskeyAssertion", clientId, sequenceNumber, request);
      // II: Stopped here!
      const controller = new AbortController();
      void this.fido2AuthenticatorService
        .getAssertion(
          this.convertAssertionRequest(request),
          { windowXy: request.windowXy },
          controller,
        )
        .then((response) => {
          callback(null, this.convertAssertionResponse(request, response));
        })
        .catch((error) => {
          this.logService.error("listenPasskeyAssertion error", error);
          callback(error, null);
        });
    });
  }

  private convertRegistrationRequest(
    request: autofill.PasskeyRegistrationRequest,
  ): Fido2AuthenticatorMakeCredentialsParams {
    return {
      hash: new Uint8Array(request.clientDataHash),
      rpEntity: {
        name: request.rpId,
        id: request.rpId,
      },
      userEntity: {
        id: new Uint8Array(request.userHandle),
        name: request.userName,
        displayName: undefined,
        icon: undefined,
      },
      credTypesAndPubKeyAlgs: request.supportedAlgorithms.map((alg) => ({
        alg,
        type: "public-key",
      })),
      excludeCredentialDescriptorList: [],
      requireResidentKey: true,
      requireUserVerification:
        request.userVerification === "required" || request.userVerification === "preferred",
      fallbackSupported: false,
    };
  }

  private convertRegistrationResponse(
    request: autofill.PasskeyRegistrationRequest,
    response: Fido2AuthenticatorMakeCredentialResult,
  ): autofill.PasskeyRegistrationResponse {
    this.logService.debug("converting registrationResponse to Windows format")
    return {
      rpId: request.rpId,
      clientDataHash: request.clientDataHash,
      credentialId: Array.from(Fido2Utils.bufferSourceToUint8Array(response.credentialId)),
      attestationObject: Array.from(
        Fido2Utils.bufferSourceToUint8Array(response.attestationObject),
      ),
    };
  }

  /**
   *
   * @param request
   * @param assumeUserPresence For WithoutUserInterface requests, we assume the user is present
   * @returns
   */
  private convertAssertionRequest(
    request:
      | autofill.PasskeyAssertionRequest
      | autofill.PasskeyAssertionWithoutUserInterfaceRequest,
  ): Fido2AuthenticatorGetAssertionParams {
    let allowedCredentials;
    if ("credentialId" in request) {
      allowedCredentials = [
        {
          id: new Uint8Array(request.credentialId),
          type: "public-key" as const,
        },
      ];
    } else {
      allowedCredentials = request.allowedCredentials.map((credentialId) => ({
        id: new Uint8Array(credentialId),
        type: "public-key" as const,
      }));
    }

    return {
      rpId: request.rpId,
      hash: new Uint8Array(request.clientDataHash),
      allowCredentialDescriptorList: allowedCredentials,
      extensions: {},
      requireUserVerification:
        request.userVerification === "required" || request.userVerification === "preferred",
      fallbackSupported: false,
      assumeUserPresence: true, // For desktop assertions, it's safe to assume UP has been checked by OS dialogues
    };
  }

  private convertAssertionResponse(
    request:
      | autofill.PasskeyAssertionRequest
      | autofill.PasskeyAssertionWithoutUserInterfaceRequest,
    response: Fido2AuthenticatorGetAssertionResult,
  ): autofill.PasskeyAssertionResponse {
    return {
      userHandle: Array.from(new Uint8Array(response.selectedCredential.userHandle)),
      rpId: request.rpId,
      signature: Array.from(new Uint8Array(response.signature)),
      clientDataHash: request.clientDataHash,
      authenticatorData: Array.from(new Uint8Array(response.authenticatorData)),
      credentialId: Array.from(new Uint8Array(response.selectedCredential.id)),
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
