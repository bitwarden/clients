import { firstValueFrom } from "rxjs";

import {
  Fido2CredentialAutofillView,
  Fido2UserInterface,
  Fido2Authenticator,
  GetAssertionRequest,
  MakeCredentialRequest,
  PublicKeyCredentialDescriptor as SdkPublicKeyCredentialDescriptor,
  UV,
} from "@bitwarden/sdk-internal";

import { AccountService } from "../../../auth/abstractions/account.service";
import { getUserId } from "../../../auth/services/account.service";
import { UserId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { SyncService } from "../../../vault/abstractions/sync/sync.service.abstraction";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import {
  Fido2AuthenticatorError,
  Fido2AuthenticatorErrorCode,
  Fido2AuthenticatorGetAssertionParams,
  Fido2AuthenticatorGetAssertionResult,
  Fido2AuthenticatorMakeCredentialResult,
  Fido2AuthenticatorMakeCredentialsParams,
  Fido2AuthenticatorService,
  PublicKeyCredentialDescriptor,
} from "../../abstractions/fido2/fido2-authenticator.service.abstraction";
import { Fido2UserInterfaceService } from "../../abstractions/fido2/fido2-user-interface.service.abstraction";
import { LogService } from "../../abstractions/log.service";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import { SdkService, uuidAsString } from "../../abstractions/sdk/sdk.service";

import { compareCredentialIds, parseCredentialId } from "./credential-id-utils";
import { Fido2Utils } from "./fido2-utils";
import { NoopSdkFido2UserInterface } from "./noop-sdk-fido2-user-interface";
import { SdkFido2CredentialStore } from "./sdk-fido2-credential-store";
import { SdkFido2UserInterface } from "./sdk-fido2-user-interface";
import { withSdkClient } from "./with-sdk-client";

/**
 * How stale the vault may be before a creation ceremony syncs it. The sync exists only so the
 * `excludeCredentials` check is made against an up-to-date vault.
 */
const SYNC_THRESHOLD_MS = 1000 * 60 * 30;

/**
 * A FIDO2 authenticator backed by the SDK. Its operations follow the authenticator API in the
 * CTAP2 specification (`authenticatorMakeCredential`, `authenticatorGetAssertion`), which defines
 * their behavior.
 */
export class SdkFido2AuthenticatorService<
  ParentWindowReference,
> implements Fido2AuthenticatorService<ParentWindowReference> {
  constructor(
    private credentialStore: SdkFido2CredentialStore,
    private cipherService: CipherService,
    private userInterface: Fido2UserInterfaceService<ParentWindowReference>,
    private syncService: SyncService,
    private accountService: AccountService,
    private sdkService: SdkService,
    private logService: LogService,
  ) {}

  async makeCredential(
    params: Fido2AuthenticatorMakeCredentialsParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ): Promise<Fido2AuthenticatorMakeCredentialResult> {
    const session = await this.userInterface.newSession(
      params.fallbackSupported,
      window,
      abortController,
    );

    try {
      await session.ensureUnlockedVault();
      await this.syncBeforeCreation();

      const result = await this.withAuthenticator(
        new SdkFido2UserInterface(
          session,
          this.cipherService,
          this.accountService,
          this.logService,
        ),
        (authenticator) => authenticator.make_credential(toMakeCredentialRequest(params)),
      );

      return {
        credentialId: new Uint8Array(result.credentialId),
        attestationObject: new Uint8Array(result.attestationObject),
        authData: new Uint8Array(result.authenticatorData),
        publicKey: new Uint8Array(result.publicKey),
        publicKeyAlgorithm: result.publicKeyAlgorithm,
      };
    } finally {
      session.close();
    }
  }

  async getAssertion(
    params: Fido2AuthenticatorGetAssertionParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ): Promise<Fido2AuthenticatorGetAssertionResult> {
    const session = await this.userInterface.newSession(
      params.fallbackSupported,
      window,
      abortController,
    );

    try {
      await session.ensureUnlockedVault();
      await this.syncBeforeAssertion(params);

      const result = await this.withAuthenticator(
        new SdkFido2UserInterface(
          session,
          this.cipherService,
          this.accountService,
          this.logService,
          params.assumeUserPresence ?? false,
        ),
        (authenticator) => authenticator.get_assertion(toGetAssertionRequest(params)),
      );

      return {
        selectedCredential: {
          id: new Uint8Array(result.credentialId),
          userHandle: new Uint8Array(result.userHandle),
        },
        authenticatorData: new Uint8Array(result.authenticatorData),
        signature: new Uint8Array(result.signature),
      };
    } finally {
      session.close();
    }
  }

  private async syncBeforeCreation(): Promise<void> {
    const lastSync = await firstValueFrom(this.syncService.activeUserLastSync$());
    const threshold = new Date().getTime() - SYNC_THRESHOLD_MS;

    const stale = lastSync == null || lastSync.getTime() < threshold;
    this.logService.mark(`[SDK FIDO2] Creation sync ${stale ? "started" : "skipped"}`);

    if (stale) {
      await this.syncService.fullSync(false);
    }
  }

  /** Syncs unless every matching passkey is already here and has never been used. */
  private async syncBeforeAssertion(params: Fido2AuthenticatorGetAssertionParams): Promise<void> {
    const found = await this.credentialStore.findCredentialCiphers(
      params.allowCredentialDescriptorList?.map((descriptor) => descriptor.id),
      params.rpId,
    );

    // A non-zero counter means the passkey may have been used elsewhere since the last sync.
    const stale = found.some((cipher) =>
      cipher.login.fido2Credentials.some((credential) => credential.counter > 0),
    );

    const sync = found.length === 0 || stale;
    this.logService.mark(`[SDK FIDO2] Assertion sync ${sync ? "started" : "skipped"}`);

    // FIXME: A full sync of a large vault mid-login can look like a hang. A counter passkey that is
    // already here could refresh just its own cipher; one created on another device has no local id
    // to fetch, so that case still needs a full sync.
    if (sync) {
      await this.syncService.fullSync(false);
    }
  }

  async silentCredentialDiscovery(rpId: string): Promise<Fido2CredentialView[]> {
    const discovered = await this.withAuthenticator(
      new NoopSdkFido2UserInterface(this.logService),
      (authenticator) => authenticator.silently_discover_credentials(rpId, undefined),
    );

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await this.toCredentialViews(discovered, userId);
  }

  /** Runs one operation against an SDK authenticator built on the given user interface. */
  private async withAuthenticator<T>(
    userInterface: Fido2UserInterface,
    operation: (authenticator: Fido2Authenticator) => Promise<T>,
  ): Promise<T> {
    await SdkLoadService.Ready;

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    return await withSdkClient(this.sdkService, userId, async (client) => {
      using authenticator = client
        .platform()
        .fido2()
        .authenticator(userInterface, this.credentialStore);
      return await operation(authenticator);
    });
  }

  /** Returns the vault's own view of each credential the SDK discovered. */
  private async toCredentialViews(
    discovered: Fido2CredentialAutofillView[],
    userId: UserId,
  ): Promise<Fido2CredentialView[]> {
    if (discovered.length === 0) {
      return [];
    }

    // `Fido2CredentialAutofillView` lacks `keyValue`, `counter` and `creationDate`.
    const ciphers = await this.cipherService.getAllDecrypted(userId);
    const ciphersById = new Map<string, CipherView>(
      ciphers.filter((cipher) => cipher.id != null).map((cipher) => [cipher.id, cipher]),
    );

    const views: Fido2CredentialView[] = [];
    for (const credential of discovered) {
      const view = this.findCredential(credential, ciphersById);
      if (view === undefined) {
        this.logService.warning(
          "[SdkFido2AuthenticatorService] Discarding a discovered credential that is no longer in the vault.",
        );
        continue;
      }
      views.push(view);
    }

    return views;
  }

  private findCredential(
    credential: Fido2CredentialAutofillView,
    ciphersById: Map<string, CipherView>,
  ): Fido2CredentialView | undefined {
    const cipher = ciphersById.get(uuidAsString(credential.cipherId));
    if (cipher === undefined || !cipher.login?.hasFido2Credentials) {
      return undefined;
    }

    // A cipher may hold two passkeys for one relying party.
    const discoveredId = new Uint8Array(credential.credentialId);
    return cipher.login.fido2Credentials.find((view) => {
      const id = parseCredentialId(view.credentialId);
      return id !== undefined && compareCredentialIds(id, discoveredId);
    });
  }
}

/** Converts a creation request to the SDK's `MakeCredentialRequest`. */
function toMakeCredentialRequest(
  params: Fido2AuthenticatorMakeCredentialsParams,
): MakeCredentialRequest {
  const rpId = params.rpEntity.id;
  if (rpId === undefined) {
    throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.Unknown);
  }

  return {
    clientDataHash: Array.from(Fido2Utils.bufferSourceToUint8Array(params.hash)),
    rp: { id: rpId, name: params.rpEntity.name },
    user: {
      id: Array.from(params.userEntity.id),
      name: params.userEntity.name ?? "",
      displayName: params.userEntity.displayName ?? "",
    },
    pubKeyCredParams: params.credTypesAndPubKeyAlgs.map((parameters) => ({
      ty: parameters.type,
      alg: parameters.alg,
    })),
    excludeList: params.excludeCredentialDescriptorList?.map(toSdkDescriptor),
    options: { rk: params.requireResidentKey, uv: toSdkUv(params.requireUserVerification) },
    // The SDK only supports `prf`, which this request never carries.
    extensions: undefined,
  };
}

function toGetAssertionRequest(params: Fido2AuthenticatorGetAssertionParams): GetAssertionRequest {
  return {
    rpId: params.rpId,
    clientDataHash: Array.from(Fido2Utils.bufferSourceToUint8Array(params.hash)),
    allowList: params.allowCredentialDescriptorList?.map(toSdkDescriptor),
    // `rk` has no meaning for `get_assertion`.
    options: { rk: false, uv: toSdkUv(params.requireUserVerification) },
    extensions: undefined,
  };
}

function toSdkDescriptor(
  descriptor: PublicKeyCredentialDescriptor,
): SdkPublicKeyCredentialDescriptor {
  return {
    ty: descriptor.type,
    id: Array.from(descriptor.id),
    transports: descriptor.transports,
  };
}

/** Converts the client's user verification flag to the SDK's `UV`. */
function toSdkUv(requireUserVerification: boolean): UV {
  // The client layer has already folded `"preferred"` and the WebAuthn default into `true`, so
  // `true` means `required`.
  return requireUserVerification ? "required" : "discouraged";
}
