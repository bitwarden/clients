import { CDPSession, Page } from "@playwright/test";

/**
 * A software authenticator attached to the page through the Chrome DevTools
 * WebAuthn domain. It answers `navigator.credentials` calls without prompts,
 * and supports the PRF extension the vault needs to derive its encryption key.
 * Chromium only.
 */
export class VirtualAuthenticator {
  private constructor(
    private session: CDPSession,
    private id: string,
  ) {}

  static async attach(page: Page): Promise<VirtualAuthenticator> {
    const session = await page.context().newCDPSession(page);
    await session.send("WebAuthn.enable");

    // Resident keys: login with passkey asks for a discoverable credential, without an email.
    const { authenticatorId } = await session.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        hasPrf: true,
        automaticPresenceSimulation: true,
      },
    });

    return new VirtualAuthenticator(session, authenticatorId);
  }

  async detach() {
    await this.session.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId: this.id });
    await this.session.detach();
  }
}
