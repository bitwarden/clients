import { filter, firstValueFrom, map, timeout } from "rxjs";

import {
  CheckUserAndPickCredentialForCreationResult,
  CheckUserOptions,
  CheckUserResult,
  CipherRepromptType as SdkCipherRepromptType,
  Fido2CredentialNewView,
  Fido2UiHint,
  Fido2UserInterface,
  CipherView as SdkCipherView,
} from "@bitwarden/sdk-internal";

import { AccountService } from "../../../auth/abstractions/account.service";
import { getUserId } from "../../../auth/services/account.service";
import { CipherId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { Cipher } from "../../../vault/models/domain/cipher";
import { Fido2UserInterfaceSession } from "../../abstractions/fido2/fido2-user-interface.service.abstraction";
import { LogService } from "../../abstractions/log.service";
import { uuidAsString } from "../../abstractions/sdk/sdk.service";

import { Fido2Utils } from "./fido2-utils";

const CIPHER_APPEARANCE_TIMEOUT_MS = 5000;

const DECLINED: CheckUserResult = { userPresent: false, userVerified: false };

/**
 * Satisfies the SDK's `Fido2UserInterface` by driving one clients user-interface session.
 *
 * **One instance per ceremony.** The SDK's callbacks carry no session identity, so binding the
 * adapter to a single session supplies it; reusing an instance drives the wrong window.
 *
 * Construct with {@link create}, not `new` — the session is opened asynchronously, but
 * `is_verification_enabled` must be readable synchronously.
 *
 * Cipher ids cross through {@link uuidAsString} because the SDK declares `Uuid` as `unknown`
 * (`custom_types.rs:13`), which neither compares against nor assigns to the session's `string[]`.
 */
export class SdkFido2UserInterface implements Fido2UserInterface {
  /**
   * Always `true`, and deliberately not derived from the request.
   *
   * The SDK uses it for one decision: whether `UV::Preferred` counts as required. Clients already
   * folds `"preferred"` and the WebAuthn default into `true` (`fido2-client.service.ts:537-540`),
   * so `false` here would downgrade verification for every request but `"discouraged"`.
   */
  readonly is_verification_enabled = true;

  private constructor(
    private session: Fido2UserInterfaceSession,
    private cipherService: CipherService,
    private accountService: AccountService,
    private logService?: LogService,
    private assumeUserPresence: boolean = false,
  ) {}

  /**
   * @param assumeUserPresence Set only on the mediated conditional path, after the user picked a
   *   credential in the inline menu; the sessions use it to skip prompting again. No CTAP field
   *   carries it, so it lives on this per-ceremony adapter.
   */
  static create(
    session: Fido2UserInterfaceSession,
    cipherService: CipherService,
    accountService: AccountService,
    logService?: LogService,
    assumeUserPresence: boolean = false,
  ): SdkFido2UserInterface {
    return new SdkFido2UserInterface(
      session,
      cipherService,
      accountService,
      logService,
      assumeUserPresence,
    );
  }

  /**
   * The two `inform*` hints are terminal: the user is being told why the ceremony stopped, so they
   * report neither presence nor verification and the authenticator aborts.
   */
  async check_user(options: CheckUserOptions, hint: Fido2UiHint): Promise<CheckUserResult> {
    this.logService?.info(
      `[PM-8313 trace] SDK -> check_user(${typeof hint === "string" ? hint : Object.keys(hint)[0]})`,
    );

    // The unit variant crosses as a bare string, not an object, so it has to be tested first.
    if (hint === "informNoCredentialsFound") {
      await this.session.informCredentialNotFound();
      return DECLINED;
    }

    if ("informExcludedCredentialFound" in hint) {
      const existing = hint.informExcludedCredentialFound;
      await this.session.informExcludedCredential(
        existing.id === undefined ? [] : [uuidAsString(existing.id)],
      );
      return DECLINED;
    }

    if ("requestNewCredential" in hint) {
      const { user, rp } = hint.requestNewCredential;
      const response = await this.session.confirmNewCredential({
        credentialName: rp.name ?? rp.id,
        userName: user.name,
        // The raw user id, base64url-encoded. `displayName` is not the handle.
        userHandle: Fido2Utils.arrayToString(new Uint8Array(user.id)),
        userVerification: this.requiresVerification(options),
        rpId: rp.id,
      });
      return {
        userPresent: response.cipherId !== undefined,
        userVerified: response.userVerified,
      };
    }

    const cipher = hint.requestExistingCredential;
    const response = await this.session.pickCredential({
      cipherIds: cipher.id === undefined ? [] : [uuidAsString(cipher.id)],
      userVerification: this.requiresVerification(options),
      assumeUserPresence: this.assumeUserPresence,
      masterPasswordRepromptRequired: this.requiresReprompt([cipher]),
    });
    return {
      userPresent: response.cipherId !== undefined,
      userVerified: response.userVerified,
    };
  }

  /**
   * The SDK wants a cipher back and the session returns an id, so the choice is resolved against
   * the list the SDK already supplied rather than re-read from the vault. Verification is not
   * passed here; the SDK asks for it separately via `check_user`.
   */
  async pick_credential_for_authentication(
    available_credentials: SdkCipherView[],
  ): Promise<SdkCipherView> {
    this.logService?.info(
      `[PM-8313 trace] SDK -> pick_credential_for_authentication(${available_credentials.length} candidate(s))`,
    );

    const response = await this.session.pickCredential({
      cipherIds: available_credentials
        .map((cipher) => cipher.id)
        .filter((id) => id !== undefined)
        .map(uuidAsString),
      userVerification: false,
      assumeUserPresence: this.assumeUserPresence,
      masterPasswordRepromptRequired: this.requiresReprompt(available_credentials),
    });

    const selected = available_credentials.find(
      (cipher) => cipher.id !== undefined && uuidAsString(cipher.id) === response.cipherId,
    );
    if (selected === undefined) {
      this.logService?.error(
        "[SdkFido2UserInterface] Aborting because the selected credential could not be found.",
      );
      throw new Error("The selected credential could not be found.");
    }

    return selected;
  }

  async check_user_and_pick_credential_for_creation(
    options: CheckUserOptions,
    new_credential: Fido2CredentialNewView,
  ): Promise<CheckUserAndPickCredentialForCreationResult> {
    this.logService?.info("[PM-8313 trace] SDK -> check_user_and_pick_credential_for_creation");

    const response = await this.session.confirmNewCredential({
      credentialName: new_credential.rpName ?? new_credential.rpId,
      userName: new_credential.userName ?? "",
      // Already base64url-encoded by the SDK, which is the encoding the session expects.
      userHandle: new_credential.userHandle ?? "",
      userVerification: this.requiresVerification(options),
      rpId: new_credential.rpId,
    });

    if (response.cipherId === undefined) {
      this.logService?.warning(
        "[SdkFido2UserInterface] Aborting because user confirmation was not received.",
      );
      throw new Error("User confirmation was not received.");
    }

    const cipher = await this.awaitCipher(response.cipherId as CipherId);
    return {
      // `toSdkCipherView()` drops `login.fido2Credentials`, which is safe only here: the SDK
      // overwrites them with the new credential before any read (`authenticator.rs`,
      // `set_new_fido2_credentials`). On the lookup paths it is a bug — see `reReadThroughSdk`.
      cipher: cipher.toSdkCipherView(),
      checkUserResult: {
        userPresent: true,
        userVerified: response.userVerified,
      },
    };
  }

  private requiresVerification(options: CheckUserOptions): boolean {
    return options.requireVerification === "required";
  }

  /**
   * Whether any candidate cipher is protected by a master password reprompt.
   *
   * Both sessions use it to refuse their silent-selection shortcut. Desktop's `canRetrieveSilently`
   * is `cipherIds.length === 1 && !masterPasswordRepromptRequired`
   * (`desktop-fido2-user-interface.service.ts:298-299`) and does *not* also require
   * `assumeUserPresence`, so omitting this would return a reprompt-protected credential unprompted.
   */
  private requiresReprompt(ciphers: SdkCipherView[]): boolean {
    return ciphers.some((cipher) => cipher.reprompt !== SdkCipherRepromptType.None);
  }

  /**
   * Waits for a cipher to be readable from local state: `confirmNewCredential` may have just
   * created it, in which case it is not in state yet.
   */
  private async awaitCipher(cipherId: CipherId) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const encrypted = await firstValueFrom(
      this.cipherService.ciphers$(userId).pipe(
        map((ciphers) => ciphers?.[cipherId]),
        filter((cipher) => cipher !== undefined),
        map((cipher) => new Cipher(cipher, undefined)),
        timeout({
          first: CIPHER_APPEARANCE_TIMEOUT_MS,
          with: () => {
            this.logService?.error(
              `[SdkFido2UserInterface] Cipher ${cipherId} did not appear within the timeout.`,
            );
            throw new Error(`Cipher ${cipherId} could not be found.`);
          },
        }),
      ),
    );

    return await this.cipherService.decrypt(encrypted, userId);
  }
}
