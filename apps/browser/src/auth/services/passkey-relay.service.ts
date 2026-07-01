import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BrowserApi } from "../../platform/browser/browser-api";

/**
 * Result type for passkey login relay.
 */
export interface PasskeyLoginRelayResult {
  type: "login";
  token: string;
  assertionData: string;
  prfOutput: ArrayBuffer | null;
}

/**
 * Result type for passkey unlock relay.
 */
export interface PasskeyUnlockRelayResult {
  type: "unlock";
  credentialId: string;
  prfOutput: ArrayBuffer;
}

/**
 * Union type for all passkey relay results.
 */
export type PasskeyRelayResult = PasskeyLoginRelayResult | PasskeyUnlockRelayResult;

/**
 * Service for relaying passkey results between the background script
 * and the popup. Uses chrome.storage.session for cross-context communication.
 * Handles both login and unlock flows.
 */
export class PasskeyRelayService {
  private readonly STORAGE_KEY = "passkeyRelayResult";
  private storageChangeListener: ((changes: any, areaName: string) => void) | null = null;
  private resolveStorageChange: (() => void) | null = null;

  constructor(private logService: LogService) {
    this.setupStorageListener();
  }

  private setupStorageListener(): void {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      this.storageChangeListener = (changes, areaName) => {
        if (areaName === "session" && changes[this.STORAGE_KEY]) {
          this.logService.info("[PasskeyRelay] Storage change detected");
          this.resolveStorageChange?.();
        }
      };
      BrowserApi.addListener(chrome.storage.onChanged, this.storageChangeListener);
    }
  }

  /**
   * Stores the relay result in chrome.storage.session.
   * Called from the background after processing the passkey result.
   */
  async storeResult(result: PasskeyRelayResult): Promise<void> {
    this.logService.info("[PasskeyRelay] Storing result in storage");

    // Convert ArrayBuffer to array for JSON serialization
    const storableResult = {
      ...result,
      prfOutput: result.prfOutput ? Array.from(new Uint8Array(result.prfOutput)) : null,
      timestamp: Date.now(),
    };

    await chrome.storage.session.set({ [this.STORAGE_KEY]: storableResult });
    this.logService.info("[PasskeyRelay] Result stored successfully");
  }

  /**
   * Retrieves and clears the relay result.
   * Called once from the result popout.
   * @returns The stored result or null if none exists
   */
  async consumeResult(): Promise<PasskeyRelayResult | null> {
    this.logService.info("[PasskeyRelay] Attempting to consume result");

    // Check storage immediately first - the result may already be there
    // because the background stores it before opening the popup
    const data = await chrome.storage.session.get(this.STORAGE_KEY);
    let storedResult = data[this.STORAGE_KEY];

    if (!storedResult) {
      // Result not yet in storage, wait for it with a short timeout
      this.logService.info(
        "[PasskeyRelay] Result not in storage yet, waiting for storage change...",
      );
      try {
        await this.waitForStorageChange(5000); // 5 seconds timeout

        // Try again after receiving the event
        const dataAfterEvent = await chrome.storage.session.get(this.STORAGE_KEY);
        storedResult = dataAfterEvent[this.STORAGE_KEY];
      } catch {
        this.logService.error("[PasskeyRelay] Timeout waiting for result");
        return null;
      }
    }

    if (!storedResult) {
      this.logService.error("[PasskeyRelay] No result found in storage");
      return null;
    }

    this.logService.info("[PasskeyRelay] Result found, converting format");

    // Clear the result from storage
    await chrome.storage.session.remove(this.STORAGE_KEY);

    // Convert array back to ArrayBuffer
    const prfOutput = storedResult.prfOutput ? new Uint8Array(storedResult.prfOutput).buffer : null;

    // Reconstruct the result based on type
    const result: PasskeyRelayResult =
      storedResult.type === "login"
        ? {
            type: "login",
            token: storedResult.token,
            assertionData: storedResult.assertionData,
            prfOutput,
          }
        : {
            type: "unlock",
            credentialId: storedResult.credentialId,
            prfOutput: prfOutput as ArrayBuffer, // unlock always has prfOutput
          };

    this.logService.info("[PasskeyRelay] Result consumed successfully");
    return result;
  }

  /**
   * Waits for the storage change event with a timeout.
   */
  private waitForStorageChange(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.resolveStorageChange = null;
        reject(new Error("Timeout"));
      }, timeoutMs);

      this.resolveStorageChange = () => {
        clearTimeout(timeoutId);
        this.resolveStorageChange = null;
        resolve();
      };
    });
  }

  /**
   * Checks if there's a pending result available.
   */
  async hasPendingResult(): Promise<boolean> {
    const data = await chrome.storage.session.get(this.STORAGE_KEY);
    const storedResult = data[this.STORAGE_KEY];

    if (!storedResult) {
      return false;
    }

    // Check if result is expired (older than 5 minutes)
    const maxAge = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - storedResult.timestamp > maxAge) {
      await chrome.storage.session.remove(this.STORAGE_KEY);
      return false;
    }

    return true;
  }

  /**
   * Clears any pending result without consuming it.
   * Used for cleanup (e.g., on timeout).
   */
  async clearResult(): Promise<void> {
    this.logService.info("[PasskeyRelay] Clearing result from storage");
    await chrome.storage.session.remove(this.STORAGE_KEY);
  }
}
