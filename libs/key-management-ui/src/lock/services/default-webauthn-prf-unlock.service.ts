import { firstValueFrom } from "rxjs";

import {
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
  WebAuthnPrfUserDecryptionOption,
} from "@bitwarden/auth/common";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";
import { UserId } from "@bitwarden/common/types/guid";
import { PrfKey, UserKey } from "@bitwarden/common/types/key";

import { UnlockViaWebAuthnComponentService } from "./unlock-via-webauthn-component.service";
import { WebAuthnPrfUnlockService } from "./webauthn-prf-unlock.service";

export class DefaultWebAuthnPrfUnlockService implements WebAuthnPrfUnlockService {
  private navigatorCredentials: CredentialsContainer;

  constructor(
    private webAuthnLoginPrfKeyService: WebAuthnLoginPrfKeyServiceAbstraction,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private encryptService: EncryptService,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private window: Window,
    private logService: LogService,
    private configService: ConfigService,
    private unlockViaWebAuthnComponentService?: UnlockViaWebAuthnComponentService,
  ) {
    this.navigatorCredentials = this.window.navigator.credentials;
  }

  async isPrfUnlockAvailable(userId: UserId): Promise<boolean> {
    try {
      // Check if browser supports WebAuthn
      if (!this.navigatorCredentials || !this.navigatorCredentials.get) {
        return false;
      }

      // PRF unlock is supported on Web and browser extensions (including Firefox via relay)
      const clientType = this.platformUtilsService.getClientType();
      if (clientType !== ClientType.Web && clientType !== ClientType.Browser) {
        return false;
      }

      // Check if user has any WebAuthn PRF credentials registered
      const credentials = await this.getPrfUnlockCredentials(userId);
      if (credentials.length === 0) {
        return false;
      }

      return true;
    } catch (error) {
      this.logService.error("Error checking PRF unlock availability:", error);
      return false;
    }
  }

  private async getPrfUnlockCredentials(
    userId: UserId,
  ): Promise<{ credentialId: string; transports: string[] }[]> {
    try {
      const userDecryptionOptions = await this.getUserDecryptionOptions(userId);
      if (!userDecryptionOptions?.webAuthnPrfOptions) {
        return [];
      }
      return userDecryptionOptions.webAuthnPrfOptions.map((option) => ({
        credentialId: option.credentialId,
        transports: option.transports,
      }));
    } catch (error) {
      this.logService.error("Error getting PRF unlock credentials:", error);
      return [];
    }
  }

  /**
   * Unlocks the vault using WebAuthn PRF.
   *
   * @param userId The user ID to unlock vault for
   * @returns Promise<UserKey> the decrypted user key
   * @throws Error if unlock fails for any reason
   */
  async unlockVaultWithPrf(userId: UserId): Promise<UserKey> {
    // Get offline PRF credentials from user decryption options
    const credentials = await this.getPrfUnlockCredentials(userId);
    if (credentials.length === 0) {
      throw new Error("No PRF credentials available for unlock");
    }

    // Check if we should use the web vault relay mechanism (Firefox)
    if (this.unlockViaWebAuthnComponentService?.shouldUseWebVaultRelay()) {
      return this.unlockVaultWithPrfViaRelay(userId, credentials);
    }

    const response = await this.performWebAuthnGetWithPrf(credentials, userId);
    const prfKey = await this.createPrfKeyFromResponse(response);
    const prfOption = await this.getPrfOptionForCredential(response.id, userId);

    // PRF unlock follows the same key derivation process as PRF login:
    // PRF key → decrypt private key → use private key to decrypt user key

    // Step 1: Decrypt PRF encrypted private key using the PRF key
    const privateKey = await this.encryptService.unwrapDecapsulationKey(
      new EncString(prfOption.encryptedPrivateKey),
      prfKey,
    );

    // Step 2: Use private key to decrypt user key
    const userKey = await this.encryptService.decapsulateKeyUnsigned(
      new EncString(prfOption.encryptedUserKey),
      privateKey,
    );

    if (!userKey) {
      throw new Error("Failed to decrypt user key from private key");
    }

    return userKey as UserKey;
  }

  /**
   * Unlocks the vault using WebAuthn PRF via the web vault relay mechanism.
   * Used for Firefox which cannot call credentials.get() with a custom RP ID from an extension.
   *
   * Note: This method opens the relay tab and returns. The actual unlock is completed
   * by the unlock result popout component. This method never returns successfully - it
   * either throws immediately on error, or the relay flow handles the unlock separately.
   *
   * @param userId The user ID to unlock vault for
   * @param credentials Available PRF credentials for the user
   * @throws Error always throws since the unlock is handled by the result popout
   */
  private async unlockVaultWithPrfViaRelay(
    userId: UserId,
    credentials: { credentialId: string; transports: string[] }[],
  ): Promise<UserKey> {
    this.logService.info("[PasskeyUnlockRelay] Starting relay-based PRF unlock");

    if (!this.unlockViaWebAuthnComponentService) {
      throw new Error("UnlockViaWebAuthnComponentService is required for relay-based unlock");
    }

    // Open the web vault relay tab
    await this.unlockViaWebAuthnComponentService.openWebVaultRelayTab();

    // The relay tab has been opened. The actual unlock will happen in the
    // unlock result popout component when the user completes the WebAuthn flow.
    // We throw a specific error that the caller can recognize to know the
    // relay flow has been initiated.
    throw new Error("RelayFlowInitiated");
  }

  /**
   * Performs WebAuthn get operation with PRF extension.
   *
   * @param credentials Available PRF credentials for the user
   * @returns PublicKeyCredential response from the authenticator
   * @throws Error if WebAuthn operation fails or returns invalid response
   */
  private async performWebAuthnGetWithPrf(
    credentials: { credentialId: string; transports: string[] }[],
    userId: UserId,
  ): Promise<PublicKeyCredential> {
    const rpId = await this.getRpIdForUser(userId);
    const prfSalt = await this.getUnlockWithPrfSalt();

    const options: CredentialRequestOptions = {
      publicKey: {
        challenge: new Uint8Array(32),
        allowCredentials: credentials.map(({ credentialId, transports }) => {
          // The credential ID is already base64url encoded from login storage
          // We need to decode it to ArrayBuffer for WebAuthn
          const decodedId = Fido2Utils.stringToArray(credentialId);
          return {
            type: "public-key",
            id: decodedId,
            transports: (transports || []) as AuthenticatorTransport[],
          };
        }),
        rpId,
        userVerification: "preferred", // Allow platform authenticators to work properly
        extensions: {
          prf: { eval: { first: prfSalt } },
        } as any,
      },
    };

    const response = await this.navigatorCredentials.get(options);

    if (!response) {
      throw new Error("WebAuthn get() returned null/undefined");
    }

    if (!(response instanceof PublicKeyCredential)) {
      throw new Error("Failed to get PRF credential for unlock");
    }

    return response;
  }

  /**
   * Extracts PRF result from WebAuthn response and creates a PrfKey.
   *
   * @param response PublicKeyCredential response from authenticator
   * @returns PrfKey derived from the PRF extension output
   * @throws Error if no PRF result is present in the response
   */
  private async createPrfKeyFromResponse(response: PublicKeyCredential): Promise<PrfKey> {
    // Extract PRF result
    // TODO: Remove `any` when typescript typings add support for PRF
    const extensionResults = response.getClientExtensionResults() as any;
    const prfResult = extensionResults.prf?.results?.first;
    if (!prfResult) {
      throw new Error("No PRF result received from authenticator");
    }

    try {
      return await this.webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf(prfResult);
    } catch (error) {
      this.logService.error("Failed to create unlock key from PRF:", error);
      throw error;
    }
  }

  /**
   * Gets the WebAuthn PRF option that matches the credential used in the response.
   *
   * @param credentialId Credential ID to match
   * @param userId User ID to get decryption options for
   * @returns Matching WebAuthnPrfUserDecryptionOption with encrypted keys
   * @throws Error if no PRF options exist or no matching option is found
   */
  private async getPrfOptionForCredential(
    credentialId: string,
    userId: UserId,
  ): Promise<WebAuthnPrfUserDecryptionOption> {
    const userDecryptionOptions = await this.getUserDecryptionOptions(userId);

    if (
      !userDecryptionOptions?.webAuthnPrfOptions ||
      userDecryptionOptions.webAuthnPrfOptions.length === 0
    ) {
      throw new Error("No WebAuthn PRF option found for user - cannot perform PRF unlock");
    }

    const prfOption = userDecryptionOptions.webAuthnPrfOptions.find(
      (option) => option.credentialId === credentialId,
    );

    if (!prfOption) {
      throw new Error("No matching WebAuthn PRF option found for this credential");
    }

    return prfOption;
  }

  private async getUnlockWithPrfSalt(): Promise<Uint8Array<ArrayBuffer>> {
    try {
      // Use the same salt as login to ensure PRF keys match
      return await this.webAuthnLoginPrfKeyService.getLoginWithPrfSalt();
    } catch (error) {
      this.logService.error("Error getting unlock PRF salt:", error);
      throw error;
    }
  }

  /**
   * Helper method to get user decryption options for a user
   */
  private async getUserDecryptionOptions(userId: UserId): Promise<UserDecryptionOptions | null> {
    try {
      return (await firstValueFrom(
        this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
      )) as UserDecryptionOptions;
    } catch (error) {
      this.logService.error("Error getting user decryption options:", error);
      return null;
    }
  }

  /**
   * Helper method to get the appropriate rpId for WebAuthn PRF operations
   * Returns the hostname from the user's environment configuration
   */
  private async getRpIdForUser(userId: UserId): Promise<string | undefined> {
    try {
      const environment = await firstValueFrom(this.environmentService.getEnvironment$(userId));
      const hostname = Utils.getHost(environment.getWebVaultUrl());

      // The navigator.credentials.get call will fail if rpId is set but is null/empty. Undefined uses the current host.
      if (!hostname) {
        return undefined;
      }

      // Extract hostname using URL parsing to handle IPv6 and ports correctly
      // This removes ports etc.
      const url = new URL(`https://${hostname}`);
      const rpId = url.hostname;

      return rpId;
    } catch (error) {
      this.logService.error("Error getting rpId", error);
      return undefined;
    }
  }
}
