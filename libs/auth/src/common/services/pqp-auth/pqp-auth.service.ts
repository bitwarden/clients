import { Injectable } from "@angular/core";
import {
  getUserInfo,
  isLoggedIn as isPqpLoggedIn,
  login as pqpLogin,
  localStateRepository,
  ServiceLocator,
  sha256,
} from "@ovrlab/pqp-network";
import type { IdentityProvider } from "@ovrlab/pqp-network";

export interface PqpAuthState {
  networkLoggedIn: boolean;
  userEmail: string | null;
  derivedPassword: string | null;
  isReady: boolean;
}

/**
 * Shared service for PqP authentication functionality.
 * Centralizes PqP Network login and password derivation.
 * Platform-agnostic - uses ServiceLocator.getMessaging() for cross-context communication.
 */
@Injectable({ providedIn: "root" })
export class PqpAuthService {
  private _networkLoggedIn = false;
  private _userEmail: string | null = null;
  private _derivedPassword: string | null = null;

  get networkLoggedIn(): boolean {
    return this._networkLoggedIn;
  }

  get userEmail(): string | null {
    return this._userEmail;
  }

  get derivedPassword(): string | null {
    return this._derivedPassword;
  }

  get isReady(): boolean {
    return this._networkLoggedIn;
  }

  getState(): PqpAuthState {
    return {
      networkLoggedIn: this._networkLoggedIn,
      userEmail: this._userEmail,
      derivedPassword: this._derivedPassword,
      isReady: this.isReady,
    };
  }

  /**
   * Check the current PqP authentication status.
   * Uses ServiceLocator messaging when available, falls back to direct API call.
   */
  async checkStatus(): Promise<PqpAuthState> {
    try {
      let loggedIn = false;
      try {
        const messaging = ServiceLocator.getMessaging();
        const response = await messaging.sendWithResponse("CHECK_STATUS");
        loggedIn = response?.loggedIn ?? false;
      } catch {
        // Messaging not available (e.g. background context or desktop) — use direct API
        loggedIn = await isPqpLoggedIn();
      }
      this._networkLoggedIn = loggedIn;

      // Fetch or clear user info based on network login state
      if (this._networkLoggedIn) {
        const userInfo = await getUserInfo();
        if (userInfo) {
          this._userEmail = userInfo.email || null;
        }
        await this.derivePassword();
      } else {
        // Clear stale data when logged out
        this._userEmail = null;
        this._derivedPassword = null;
      }
    } catch {
      // Reset all state on error to prevent stale data from being reused
      this._networkLoggedIn = false;
      this._userEmail = null;
      this._derivedPassword = null;
    }

    return this.getState();
  }

  /**
   * Login to PqP Network.
   * Uses ServiceLocator messaging when available (browser extension), falls back to direct API.
   * Returns a promise that resolves when login is detected via focus event.
   */
  async loginToPqpNetwork(provider: IdentityProvider = "google"): Promise<boolean> {
    const messageType = provider === "microsoft" ? "LOGIN_MICROSOFT" : "LOGIN";

    return new Promise((resolve) => {
      let resolved = false;
      let focusCount = 0;

      const cleanup = () => {
        window.removeEventListener("focus", checkLoginStatus);
      };

      const checkLoginStatus = async () => {
        if (resolved) {
          return;
        }

        focusCount++;
        try {
          let loggedIn = false;
          try {
            const messaging = ServiceLocator.getMessaging();
            const response = await messaging.sendWithResponse("CHECK_STATUS");
            loggedIn = response?.loggedIn ?? false;
          } catch {
            loggedIn = await isPqpLoggedIn();
          }

          if (loggedIn) {
            resolved = true;
            cleanup();
            this._networkLoggedIn = true;
            const userInfo = await getUserInfo();
            if (userInfo) {
              this._userEmail = userInfo.email || null;
            }
            await this.derivePassword();
            resolve(true);
          } else if (focusCount >= 2) {
            resolved = true;
            cleanup();
            resolve(false);
          }
        } catch {
          if (focusCount >= 2) {
            resolved = true;
            cleanup();
            resolve(false);
          }
        }
      };

      try {
        // Try messaging (browser extension), fall back to direct API (desktop/other)
        try {
          const messaging = ServiceLocator.getMessaging();
          messaging.send(messageType);
        } catch {
          void pqpLogin(provider);
        }
        window.addEventListener("focus", checkLoginStatus);

        // Also check immediately after a short delay (in case already logged in)
        setTimeout(() => void checkLoginStatus(), 500);
      } catch {
        resolved = true;
        cleanup();
        resolve(false);
      }
    });
  }

  /**
   * Derive the master password from the PqP private key using SHA-256.
   * Clears any stale password if the private key is unavailable or on error.
   */
  async derivePassword(): Promise<string | null> {
    try {
      const privateKey = await localStateRepository.getPrivateKey();
      if (privateKey) {
        this._derivedPassword = await sha256(privateKey);
      } else {
        // Clear stale password when private key is no longer available
        this._derivedPassword = null;
      }
    } catch {
      // Clear stale password on error to prevent using outdated credentials
      this._derivedPassword = null;
    }
    return this._derivedPassword;
  }

  /**
   * Reset all state (for logout scenarios).
   */
  reset(): void {
    this._networkLoggedIn = false;
    this._userEmail = null;
    this._derivedPassword = null;
  }
}
