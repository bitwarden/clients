import { firstValueFrom, Observable, switchMap } from "rxjs";

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
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { UserId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { SyncService } from "../../../vault/abstractions/sync/sync.service.abstraction";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import { ConfigService } from "../../abstractions/config/config.service";
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

/**
 * How stale the vault may be before a creation ceremony syncs it. The sync exists only so the
 * `excludeCredentials` check is made against an up-to-date vault.
 */
const SYNC_THRESHOLD_MS = 1000 * 60 * 30;

/**
 * A FIDO2 authenticator backed by the SDK, used when
 * {@link FeatureFlag.PM8313_Fido2OperationsToSdk} is on. With the flag off, every operation
 * delegates to the wrapped TypeScript {@link Fido2AuthenticatorService}.
 */
export class SdkFido2AuthenticatorService<
  ParentWindowReference,
> implements Fido2AuthenticatorService<ParentWindowReference> {
  private readonly sdkFido2Enabled$: Observable<boolean> = this.configService.getFeatureFlag$(
    FeatureFlag.PM8313_Fido2OperationsToSdk,
  );

  constructor(
    private fallback: Fido2AuthenticatorService<ParentWindowReference>,
    private credentialStore: SdkFido2CredentialStore,
    private cipherService: CipherService,
    private userInterface: Fido2UserInterfaceService<ParentWindowReference>,
    private syncService: SyncService,
    private accountService: AccountService,
    private sdkService: SdkService,
    private configService: ConfigService,
    private logService: LogService,
  ) {}

  async makeCredential(
    params: Fido2AuthenticatorMakeCredentialsParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ): Promise<Fido2AuthenticatorMakeCredentialResult> {
    const useSdk = await firstValueFrom(this.sdkFido2Enabled$);
    if (!useSdk) {
      this.logService.info("[PM-8313 trace] makeCredential -> TypeScript (flag off)");
      return await this.fallback.makeCredential(params, window, abortController);
    }
    this.logService.info("[PM-8313 trace] makeCredential -> SDK");

    // No fall-back-to-TypeScript catch: see `silentCredentialDiscovery`, and because a retry
    // after the SDK has prompted would ask the user to approve the same ceremony twice.
    return await this.makeCredentialUsingSdk(params, window, abortController);
  }

  async getAssertion(
    params: Fido2AuthenticatorGetAssertionParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ): Promise<Fido2AuthenticatorGetAssertionResult> {
    const useSdk = await firstValueFrom(this.sdkFido2Enabled$);
    if (!useSdk) {
      this.logService.info("[PM-8313 trace] getAssertion -> TypeScript (flag off)");
      return await this.fallback.getAssertion(params, window, abortController);
    }
    this.logService.info("[PM-8313 trace] getAssertion -> SDK");

    return await this.getAssertionUsingSdk(params, window, abortController);
  }

  private async makeCredentialUsingSdk(
    params: Fido2AuthenticatorMakeCredentialsParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ): Promise<Fido2AuthenticatorMakeCredentialResult> {
    // The session owns the popup and the caller's `AbortController`, neither of which the SDK
    // knows about. Opened here, not in the adapter, so the `finally` below always closes it.
    const session = await this.userInterface.newSession(
      params.fallbackSupported,
      window,
      abortController,
    );

    try {
      await session.ensureUnlockedVault();
      await this.syncBeforeCreation();

      const result = await this.withAuthenticator(
        SdkFido2UserInterface.create(
          session,
          this.cipherService,
          this.accountService,
          this.logService,
        ),
        (authenticator) => authenticator.make_credential(toMakeCredentialRequest(params)),
      );

      this.logService.info(
        `[PM-8313 trace] SDK make_credential returned: credentialId ${result.credentialId.length}B, ` +
          `attestationObject ${result.attestationObject.length}B, publicKey ${result.publicKey.length}B, ` +
          `alg ${result.publicKeyAlgorithm}`,
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

  private async getAssertionUsingSdk(
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
        SdkFido2UserInterface.create(
          session,
          this.cipherService,
          this.accountService,
          this.logService,
          params.assumeUserPresence ?? false,
        ),
        (authenticator) => authenticator.get_assertion(toGetAssertionRequest(params)),
      );

      this.logService.info(
        `[PM-8313 trace] SDK get_assertion returned: credentialId ${result.credentialId.length}B, ` +
          `authenticatorData ${result.authenticatorData.length}B, signature ${result.signature.length}B`,
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
    this.logService.info(
      `[PM-8313 trace] creation sync: lastSync ${lastSync == null ? "never" : `${Math.round((Date.now() - lastSync.getTime()) / 60000)}m ago`} -> ${stale ? "syncing" : "skipping"}`,
    );

    if (stale) {
      await this.syncService.fullSync(false);
    }
  }

  /**
   * Syncs unless the credential is already here and has never been used: a non-zero counter means
   * it is asserted from more than one place, so the local copy may be behind. No re-read after —
   * the SDK looks up again through {@link SdkFido2CredentialStore} once the ceremony starts.
   */
  private async syncBeforeAssertion(params: Fido2AuthenticatorGetAssertionParams): Promise<void> {
    const found = await this.credentialStore.findCredentialCiphers(
      params.allowCredentialDescriptorList?.map((descriptor) => descriptor.id),
      params.rpId,
    );

    const stale = found.some((cipher) =>
      cipher.login.fido2Credentials.some((credential) => credential.counter > 0),
    );

    this.logService.info(
      `[PM-8313 trace] assertion sync: ${found.length} local match(es), used before: ${stale} -> ${found.length === 0 || stale ? "syncing" : "skipping"}`,
    );

    if (found.length === 0 || stale) {
      await this.syncService.fullSync(false);
    }
  }

  async silentCredentialDiscovery(rpId: string): Promise<Fido2CredentialView[]> {
    const useSdk = await firstValueFrom(this.sdkFido2Enabled$);
    if (!useSdk) {
      return this.fallback.silentCredentialDiscovery(rpId);
    }

    // No fall-back-to-TypeScript catch: a caught failure is an inline menu with no passkeys in
    // it, indistinguishable from "this site has none" — the one outcome that hides a broken SDK
    // path from the flag's rollout.
    return await this.silentCredentialDiscoveryUsingSdk(rpId);
  }

  private async silentCredentialDiscoveryUsingSdk(rpId: string): Promise<Fido2CredentialView[]> {
    const discovered = await this.withAuthenticator(
      new NoopSdkFido2UserInterface(this.logService),
      // No user handle: the request carries none. Note this argument is a `Uint8Array` while the
      // same bytes come back from the callbacks as `number[]`; both boundaries are correct.
      (authenticator) => authenticator.silently_discover_credentials(rpId, undefined),
    );

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await this.toCredentialViews(discovered, userId);
  }

  /**
   * Runs one operation against an SDK authenticator built on the given user interface. Disposal
   * matters: the authenticator owns JavaScript callbacks on the WebAssembly heap, and the client
   * reference is only valid inside the subscription — see the warning on `userClient$`.
   */
  private async withAuthenticator<T>(
    userInterface: Fido2UserInterface,
    operation: (authenticator: Fido2Authenticator) => Promise<T>,
  ): Promise<T> {
    // No FIDO2 path awaits this today. In a freshly woken MV3 worker it is a real WASM init.
    await SdkLoadService.Ready;

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("Cannot run the FIDO2 operation: the SDK client is unavailable.");
          }
          using ref = sdk.take();
          using authenticator = ref.value
            .platform()
            .fido2()
            .authenticator(userInterface, this.credentialStore);

          return await operation(authenticator);
        }),
      ),
    );
  }

  /**
   * Resolves what the SDK discovered back onto the vault's own view models.
   *
   * {@link Fido2CredentialAutofillView} carries no `keyValue`, `counter` or `creationDate`, so
   * re-reading from the vault is what avoids inventing them: the SDK decides *which* credentials
   * match, while the view model stays the fully populated one every consumer expects.
   *
   * Matching on the credential id, not just the cipher, differs from the TypeScript path's
   * `fido2Credentials[0]`: a cipher may hold two passkeys for one relying party.
   */
  private async toCredentialViews(
    discovered: Fido2CredentialAutofillView[],
    userId: UserId,
  ): Promise<Fido2CredentialView[]> {
    if (discovered.length === 0) {
      return [];
    }

    const ciphers = await this.cipherService.getAllDecrypted(userId);
    const ciphersById = new Map<string, CipherView>(
      ciphers.filter((cipher) => cipher.id != null).map((cipher) => [cipher.id, cipher]),
    );

    const views: Fido2CredentialView[] = [];
    for (const credential of discovered) {
      const view = this.findCredential(credential, ciphersById);
      if (view === undefined) {
        // Only reachable if the vault changed between the SDK's read and this one.
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

    const discoveredId = new Uint8Array(credential.credentialId);
    return cipher.login.fido2Credentials.find((view) => {
      const id = parseCredentialId(view.credentialId);
      return id !== undefined && compareCredentialIds(id, discoveredId);
    });
  }
}

/**
 * The creation request, in the shape the SDK's CTAP layer expects. Two fields are dropped on
 * purpose: `fallbackSupported`, an argument to `newSession` rather than a CTAP concept, and
 * `enterpriseAttestationPossible`, which Bitwarden ignores today.
 */
function toMakeCredentialRequest(
  params: Fido2AuthenticatorMakeCredentialsParams,
): MakeCredentialRequest {
  const rpId = params.rpEntity.id;
  if (rpId === undefined) {
    // Unreachable today: the client layer defaults this from the origin
    // (`fido2-client.service.ts:148`). Guarded so a future caller that skips it fails here.
    throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.Unknown);
  }

  return {
    clientDataHash: Array.from(Fido2Utils.bufferSourceToUint8Array(params.hash)),
    rp: { id: rpId, name: params.rpEntity.name },
    user: {
      id: Array.from(params.userEntity.id),
      // Optional here, required by the SDK. Empty is what the prompt already shows.
      name: params.userEntity.name ?? "",
      displayName: params.userEntity.displayName ?? "",
    },
    pubKeyCredParams: params.credTypesAndPubKeyAlgs.map((parameters) => ({
      ty: parameters.type,
      alg: parameters.alg,
    })),
    excludeList: params.excludeCredentialDescriptorList?.map(toSdkDescriptor),
    options: { rk: params.requireResidentKey, uv: toSdkUv(params.requireUserVerification) },
    // No overlap: the abstraction carries `appid`, `appidExclude`, `credProps` and `uvm`, the SDK
    // only `prf`. `credProps` is answered by the client layer from its own params.
    extensions: undefined,
  };
}

function toGetAssertionRequest(params: Fido2AuthenticatorGetAssertionParams): GetAssertionRequest {
  return {
    rpId: params.rpId,
    clientDataHash: Array.from(Fido2Utils.bufferSourceToUint8Array(params.hash)),
    allowList: params.allowCredentialDescriptorList?.map(toSdkDescriptor),
    // `rk` carries no meaning for CTAP `get_assertion` — passkey-rs only checks it against
    // `get_info` on the creation path — so `false` is the honest value, not a dropped field.
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

/**
 * `true` becomes `required`, not `preferred`. The two behave identically today, but `required` is
 * what the boolean means: the client layer already folded `"preferred"` and the WebAuthn default
 * into `true` (`fido2-client.service.ts:536-539`) before the authenticator sees it.
 */
function toSdkUv(requireUserVerification: boolean): UV {
  return requireUserVerification ? "required" : "discouraged";
}
