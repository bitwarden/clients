// eslint-disable-next-line no-restricted-imports -- This is an Angular component service
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";

/**
 * Browser extension implementation for unlock via WebAuthn/PRF.
 * Handles Firefox passkey unlock via the web vault connector relay mechanism.
 */
@Injectable()
export class ExtensionUnlockViaWebAuthnComponentService {
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private accountService: AccountService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
  ) {}

  /**
   * Returns true for Firefox, which requires the web vault relay mechanism
   * because it cannot call credentials.get() with a custom RP ID from an extension.
   */
  shouldUseWebVaultRelay(): boolean {
    return this.platformUtilsService.isFirefox();
  }

  /**
   * Opens the web vault connector tab for relay-based passkey unlock.
   * 1. Sends message to background to generate ephemeral ECDH key pair
   * 2. Opens connector page with public key and credential IDs in URL fragment
   */
  async openWebVaultRelayTab(): Promise<void> {
    // 1. Ask the background to generate the ephemeral ECDH key pair
    const response = await chrome.runtime.sendMessage({
      command: "initiatePasskeyRelay",
    });

    if (!response?.result) {
      throw new Error("Failed to initiate passkey unlock relay");
    }

    const extensionPublicKey = response.result;

    // 2. Get the active user and their PRF credentials
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount?.id) {
      throw new Error("No active account found");
    }
    const userId = activeAccount.id as UserId;

    // 3. Get the user's PRF credentials
    const userDecryptionOptions = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
    );

    if (!userDecryptionOptions?.webAuthnPrfOptions?.length) {
      throw new Error("No PRF credentials available for unlock");
    }

    // Serialize credential IDs for the URL
    const credentials = userDecryptionOptions.webAuthnPrfOptions.map(
      (option: { credentialId: string; transports: string[] }) => ({
        id: option.credentialId,
        transports: option.transports || [],
      }),
    );
    const credentialsParam = encodeURIComponent(JSON.stringify(credentials));

    // 4. Open the connector page with public key and credentials in fragment
    const env = await firstValueFrom(this.environmentService.environment$);
    const webVaultUrl = env.getWebVaultUrl();

    // Use URL fragment to avoid sending sensitive data to the server
    const connectorUrl = `${webVaultUrl}/passkey-connector.html#extensionPublicKey=${encodeURIComponent(extensionPublicKey)}&mode=unlock&credentials=${credentialsParam}`;

    this.platformUtilsService.launchUri(connectorUrl);
  }
}
