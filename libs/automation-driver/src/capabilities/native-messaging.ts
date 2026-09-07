import { AutomationCapability } from "../automation-capability";

/**
 * Writes the native messaging manifests from the renderer. Kept generic so this (common) file has
 * no dependency on desktop code; the desktop client supplies an implementation that forwards to
 * the main process over IPC.
 */
export interface AutomationNativeMessagingController {
  /** Resolves to the failure, or null on success. */
  generateManifests(create: boolean): Promise<Error | null>;
}

/**
 * Rewrites the native messaging manifests on demand. Desktop only.
 *
 * A browser only finds the manifest if it is already in the profile the browser was started with,
 * and the client writes it once at startup. An automated run creates its browser profile after the
 * client is up, so the test rewrites the manifest into the live profile before pairing.
 */
export class NativeMessagingCapability extends AutomationCapability {
  readonly automationName = "nativeMessaging";

  constructor(private controller: AutomationNativeMessagingController) {
    super();
  }

  /** Starts the proxy listener and rewrites the manifests. */
  async regenerateManifests(): Promise<void> {
    const error = await this.controller.generateManifests(true);

    if (error) {
      throw new Error(`failed to generate native messaging manifests: ${error}`);
    }
  }
}
