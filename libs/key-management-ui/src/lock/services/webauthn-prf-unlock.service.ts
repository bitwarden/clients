import { firstValueFrom } from "rxjs";

import {
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";
import { UserId } from "@bitwarden/common/types/guid";
import { PrfKey, UserKey } from "@bitwarden/common/types/key";
import { KeyService, WebAuthnPrfUnlockServiceAbstraction } from "@bitwarden/key-management";

export class WebAuthnPrfUnlockService implements WebAuthnPrfUnlockServiceAbstraction {
  private navigatorCredentials: CredentialsContainer;

  constructor(
    private webAuthnLoginPrfKeyService: WebAuthnLoginPrfKeyServiceAbstraction,
    private keyService: KeyService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private encryptService: EncryptService,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private window: Window,
    private logService: LogService,
  ) {
    this.navigatorCredentials = this.window.navigator.credentials;
  }

  async isPrfUnlockAvailable(userId: UserId): Promise<boolean> {
    try {
      // Check if browser supports WebAuthn
      if (!this.navigatorCredentials || !this.navigatorCredentials.get) {
        return false;
      }

      // If we're in the browser extension, check if we're in a Chromium browser
      if (
        this.platformUtilsService.getClientType() === ClientType.Browser &&
        !this.platformUtilsService.isChromium()
      ) {
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

  async unlockVaultWithPrf(userId: UserId): Promise<boolean> {
    try {
      const credentials = await this.getPrfUnlockCredentials(userId);
      if (credentials.length === 0) {
        throw new Error("No PRF credentials available for unlock");
      }

      // Get the appropriate rpId from the user's environment
      const rpId = await this.getRpIdForUser(userId);
      const prfSalt = await this.getUnlockWithPrfSalt();

      // Create credential request options
      const options: CredentialRequestOptions = {
        publicKey: {
          challenge: new Uint8Array(32),
          allowCredentials: credentials.map(({ credentialId, transports }) => {
            // The credential ID is already base64url encoded from login storage
            // We need to decode it to ArrayBuffer for WebAuthn
            const decodedId = Fido2Utils.stringToBuffer(credentialId);
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

      // Get credential with PRF - wrap in timeout to avoid hanging
      // Use shorter timeout for testing in browser extension context
      const response = await this.navigatorCredentials.get(options);

      if (!response) {
        throw new Error("WebAuthn get() returned null/undefined");
      }

      if (!(response instanceof PublicKeyCredential)) {
        throw new Error("Failed to get PRF credential for unlock");
      }

      // Extract PRF result
      // TODO: Remove `any` when typescript typings add support for PRF
      const extensionResults = response.getClientExtensionResults() as any;
      const prfResult = extensionResults.prf?.results?.first;
      if (!prfResult) {
        throw new Error("No PRF result received from authenticator");
      }

      // Create unlock key from PRF
      const prfKey = await this.createUnlockKeyFromPrf(prfResult);

      // PRF unlock must follow the same key derivation process as PRF login:
      // PRF key → decrypt private key → use private key to decrypt user key → set user key

      // First, we need to get the WebAuthn PRF option data from UserDecryptionOptions
      // This contains the encrypted private key and encrypted user key
      const userDecryptionOptions = await this.getUserDecryptionOptions(userId);

      if (
        !userDecryptionOptions?.webAuthnPrfOptions ||
        userDecryptionOptions.webAuthnPrfOptions.length === 0
      ) {
        throw new Error("No WebAuthn PRF option found for user - cannot perform PRF unlock");
      }

      // Get the credential ID from the response to find the matching option
      const responseCredentialId = Fido2Utils.bufferToString(response.rawId);
      const webAuthnPrfOption = userDecryptionOptions.webAuthnPrfOptions.find(
        (option) => option.credentialId === responseCredentialId,
      );

      if (!webAuthnPrfOption) {
        throw new Error("No matching WebAuthn PRF option found for this credential");
      }

      // Step 1: Decrypt PRF encrypted private key using the PRF key
      const privateKey = await this.encryptService.unwrapDecapsulationKey(
        new EncString(webAuthnPrfOption.encryptedPrivateKey),
        prfKey,
      );

      // Step 2: Use private key to decrypt user key
      const actualUserKey = await this.encryptService.decapsulateKeyUnsigned(
        new EncString(webAuthnPrfOption.encryptedUserKey),
        privateKey,
      );

      if (!actualUserKey) {
        throw new Error("Failed to decrypt user key from private key");
      }

      // Step 3: Set the actual user key
      await this.keyService.setUserKey(actualUserKey as UserKey, userId);

      return true;
    } catch (error) {
      this.logService.error("PRF unlock failed:", error);
      return false;
    }
  }

  private async getUnlockWithPrfSalt(): Promise<ArrayBuffer> {
    try {
      // Use the same salt as login to ensure PRF keys match
      return await this.webAuthnLoginPrfKeyService.getLoginWithPrfSalt();
    } catch (error) {
      this.logService.error("Error getting unlock PRF salt:", error);
      throw error;
    }
  }

  private async createUnlockKeyFromPrf(prf: ArrayBuffer): Promise<PrfKey> {
    try {
      return await this.webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf(prf);
    } catch (error) {
      this.logService.error("Failed to create unlock key from PRF:", error);
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
      const hostname = environment.getHostname();

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
