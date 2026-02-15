import { Injectable } from "@angular/core";
import {
  getGoogleUserInfo,
  login as pqpLogin,
  isLoggedIn as isPqpLoggedIn,
  localStateRepository,
  sha256,
} from "@ovrlab/pqp-network";

export interface PqpAuthState {
  networkLoggedIn: boolean;
  userEmail: string | null;
  derivedPassword: string | null;
  isReady: boolean;
}

/**
 * Shared service for PqP authentication functionality.
 * Centralizes PqP Network login and password derivation.
 * Platform-agnostic - can be used across browser, electron, and CLI.
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
   * Fetches PqP Network login states, user info, and derives password if ready.
   * Clears stale data when login state becomes invalid.
   */
  async checkStatus(): Promise<PqpAuthState> {
    try {
      this._networkLoggedIn = await isPqpLoggedIn();

      // Fetch or clear user info based on network login state
      if (this._networkLoggedIn) {
        const userInfo = await getGoogleUserInfo();
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
   * Opens login in new tab. Returns a promise that resolves when login is detected via focus event.
   * If the user returns without completing login, resolves false after the second focus check.
   */
  async loginToPqpNetwork(): Promise<boolean> {
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
        const isLoggedIn = await isPqpLoggedIn();

        if (isLoggedIn) {
          resolved = true;
          cleanup();
          this._networkLoggedIn = true;
          await this.derivePassword();
          resolve(true);
        } else if (focusCount >= 2) {
          // User has returned focus without completing login - treat as cancelled
          resolved = true;
          cleanup();
          resolve(false);
        }
      };

      try {
        pqpLogin();
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
