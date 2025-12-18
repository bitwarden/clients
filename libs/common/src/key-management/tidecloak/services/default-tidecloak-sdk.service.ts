import { LogService } from "../../../platform/abstractions/log.service";
import { TideCloakSdkService } from "../abstractions/tidecloak-sdk.service";

/**
 * Default implementation of the TideCloak SDK service.
 *
 * This service wraps the TideCloak JavaScript SDK for performing SMPC operations.
 * The actual TideCloak SDK should be loaded as an external dependency
 * (e.g., via npm package or script tag).
 *
 * For development/testing without the actual SDK, this provides mock implementations
 * that can be replaced by the real SDK when available.
 */
export class DefaultTideCloakSdkService implements TideCloakSdkService {
  private currentUrl: string | null = null;
  private initialized = false;

  // Reference to the actual TideCloak SDK instance
  // This will be set when the SDK is loaded
  private sdkInstance: TideCloakSdkInstance | null = null;

  constructor(private logService: LogService) {}

  async initialize(tideCloakUrl: string): Promise<void> {
    if (this.initialized && this.currentUrl === tideCloakUrl) {
      this.logService.info("[TideCloakSdk] Already initialized with same URL");
      return;
    }

    this.logService.info(`[TideCloakSdk] Initializing with URL: ${tideCloakUrl}`);

    try {
      // Attempt to load and initialize the TideCloak SDK
      this.sdkInstance = await this.loadSdk(tideCloakUrl);
      this.currentUrl = tideCloakUrl;
      this.initialized = true;
      this.logService.info("[TideCloakSdk] Successfully initialized");
    } catch (error) {
      this.logService.error("[TideCloakSdk] Failed to initialize SDK:", error);
      throw new Error(`TideCloak SDK initialization failed: ${error}`);
    }
  }

  async doDecrypt(items: Array<{ encrypted: string; tags: string[] }>): Promise<Uint8Array[]> {
    if (!this.initialized || !this.sdkInstance) {
      throw new Error("TideCloak SDK is not initialized");
    }

    this.logService.info(`[TideCloakSdk] Performing SMPC decryption for ${items.length} item(s)`);

    try {
      const results = await this.sdkInstance.doDecrypt(items);
      this.logService.info("[TideCloakSdk] Decryption completed successfully");
      return results;
    } catch (error) {
      this.logService.error("[TideCloakSdk] Decryption failed:", error);
      throw new Error(`TideCloak SMPC decryption failed: ${error}`);
    }
  }

  async doEncrypt(items: Array<{ data: Uint8Array; tags: string[] }>): Promise<string[]> {
    if (!this.initialized || !this.sdkInstance) {
      throw new Error("TideCloak SDK is not initialized");
    }

    this.logService.info(`[TideCloakSdk] Performing SMPC encryption for ${items.length} item(s)`);

    try {
      const results = await this.sdkInstance.doEncrypt(items);
      this.logService.info("[TideCloakSdk] Encryption completed successfully");
      return results;
    } catch (error) {
      this.logService.error("[TideCloakSdk] Encryption failed:", error);
      throw new Error(`TideCloak SMPC encryption failed: ${error}`);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  /**
   * Loads the TideCloak SDK from the configured source.
   * This method should be implemented based on how the SDK is distributed:
   * - If via npm: import the package dynamically
   * - If via CDN: load the script and access the global object
   *
   * @param tideCloakUrl - The TideCloak service URL for SDK configuration
   * @returns The initialized SDK instance
   */
  private async loadSdk(tideCloakUrl: string): Promise<TideCloakSdkInstance> {
    // Check if TideCloak SDK is available globally (loaded via script tag)
    const globalTideCloak = this.getGlobalTideCloak();
    if (globalTideCloak) {
      this.logService.info("[TideCloakSdk] Using globally loaded TideCloak SDK");
      return await globalTideCloak.create(tideCloakUrl);
    }

    // Try dynamic import if available as npm package
    try {
      // Note: The actual package name will depend on how TideCloak distributes their SDK
      // This is a placeholder that should be updated with the actual package name
      const TideCloakModule = await import(/* webpackIgnore: true */ "@anthropic/tidecloak-sdk");
      if (TideCloakModule?.TideCloak) {
        this.logService.info("[TideCloakSdk] Using npm-imported TideCloak SDK");
        return await TideCloakModule.TideCloak.create(tideCloakUrl);
      }
    } catch {
      // Dynamic import not available or package not found
      this.logService.warning(
        "[TideCloakSdk] npm package not available, SDK must be loaded externally",
      );
    }

    throw new Error(
      "TideCloak SDK not found. Please ensure the TideCloak SDK is loaded before using TideCloak authentication.",
    );
  }

  /**
   * Gets the globally available TideCloak SDK if loaded via script tag.
   */
  private getGlobalTideCloak(): TideCloakGlobal | null {
    if (typeof window !== "undefined" && (window as TideCloakWindow).TideCloak) {
      return (window as TideCloakWindow).TideCloak;
    }
    return null;
  }
}

/**
 * Interface for the TideCloak SDK instance.
 * This should match the actual TideCloak SDK API.
 */
interface TideCloakSdkInstance {
  doDecrypt(items: Array<{ encrypted: string; tags: string[] }>): Promise<Uint8Array[]>;
  doEncrypt(items: Array<{ data: Uint8Array; tags: string[] }>): Promise<string[]>;
}

/**
 * Interface for the global TideCloak factory.
 */
interface TideCloakGlobal {
  create(url: string): Promise<TideCloakSdkInstance>;
}

/**
 * Extends Window with TideCloak SDK global.
 */
interface TideCloakWindow extends Window {
  TideCloak?: TideCloakGlobal;
}
