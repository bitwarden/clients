// eslint-disable-next-line no-restricted-imports -- This is an Angular component service
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { LoginViaWebAuthnComponentService } from "@bitwarden/auth/angular";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

/**
 * Browser extension implementation of LoginViaWebAuthnComponentService.
 * Handles Firefox passkey login via the web vault connector relay mechanism.
 */
@Injectable()
export class ExtensionLoginViaWebAuthnComponentService implements LoginViaWebAuthnComponentService {
  showTroubleLoggingInText = false;
  leftAlignDescription = true;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
  ) {}

  /**
   * Returns true for Firefox, which requires the web vault relay mechanism
   * because it cannot call credentials.get() with a custom RP ID from an extension.
   */
  shouldUseWebVaultRelay(): boolean {
    return this.platformUtilsService.isFirefox();
  }

  /**
   * Opens the web vault connector tab for relay-based passkey login.
   * 1. Sends message to background to generate ephemeral ECDH key pair
   * 2. Opens connector page with public key in URL fragment
   */
  async openWebVaultRelayTab(): Promise<void> {
    // 1. Ask the background to generate the ephemeral ECDH key pair
    const response = await chrome.runtime.sendMessage({
      command: "initiatePasskeyRelay",
    });

    if (!response?.result) {
      throw new Error("Failed to initiate passkey login relay");
    }

    const extensionPublicKey = response.result;

    // 2. Open the connector page with public key in fragment (not sent to server)
    const env = await firstValueFrom(this.environmentService.environment$);
    const webVaultUrl = env.getWebVaultUrl();

    // Use URL fragment to avoid sending the key to the server
    const connectorUrl = `${webVaultUrl}/passkey-connector.html#extensionPublicKey=${encodeURIComponent(extensionPublicKey)}`;

    this.platformUtilsService.launchUri(connectorUrl);
  }
}
