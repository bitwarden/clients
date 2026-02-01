import { Injectable } from "@angular/core";
import {
  googleDriveLogin,
  isGoogleDriveLoggedIn,
  getGoogleUserInfo,
  login as pqpLogin,
  isLoggedIn as isPqpLoggedIn,
  localStateRepository,
  sha256,
} from "@ovrlab/pqp-network";

export interface PqpAuthState {
  googleDriveLoggedIn: boolean;
  networkLoggedIn: boolean;
  userEmail: string | null;
  userName: string | null;
  derivedPassword: string | null;
  isReady: boolean;
}

/**
 * Shared service for PqP authentication functionality.
 * Centralizes Google Drive login, PqP Network login, and password derivation.
 * Platform-agnostic - can be used across browser, electron, and CLI.
 */
@Injectable({ providedIn: "root" })
export class PqpAuthService {
  private _googleDriveLoggedIn = false;
  private _networkLoggedIn = false;
  private _userEmail: string | null = null;
  private _userName: string | null = null;
  private _derivedPassword: string | null = null;

  get googleDriveLoggedIn(): boolean {
    return this._googleDriveLoggedIn;
  }

  get networkLoggedIn(): boolean {
    return this._networkLoggedIn;
  }

  get userEmail(): string | null {
    return this._userEmail;
  }

  get userName(): string | null {
    return this._userName;
  }

  get derivedPassword(): string | null {
    return this._derivedPassword;
  }

  get isReady(): boolean {
    return this._googleDriveLoggedIn && this._networkLoggedIn;
  }

  getState(): PqpAuthState {
    return {
      googleDriveLoggedIn: this._googleDriveLoggedIn,
      networkLoggedIn: this._networkLoggedIn,
      userEmail: this._userEmail,
      userName: this._userName,
      derivedPassword: this._derivedPassword,
      isReady: this.isReady,
    };
  }

  /**
   * Check the current PqP authentication status.
   * Fetches Google Drive and PqP Network login states, user info, and derives password if ready.
   */
  async checkStatus(): Promise<PqpAuthState> {
    try {
      this._googleDriveLoggedIn = await isGoogleDriveLoggedIn();
      this._networkLoggedIn = await isPqpLoggedIn();

      if (this._googleDriveLoggedIn) {
        const userInfo = await getGoogleUserInfo();
        if (userInfo) {
          this._userEmail = userInfo.email || null;
          this._userName = userInfo.name || null;
        }
      }

      if (this.isReady) {
        await this.derivePassword();
      }
    } catch {
      // Silent catch - PqP check errors are non-critical
    }

    return this.getState();
  }

  /**
   * Login to Google Drive.
   * Returns true if successful.
   */
  async loginToGoogleDrive(): Promise<boolean> {
    try {
      const success = await googleDriveLogin();
      if (success) {
        this._googleDriveLoggedIn = true;
        const userInfo = await getGoogleUserInfo();
        if (userInfo) {
          this._userEmail = userInfo.email || null;
          this._userName = userInfo.name || null;
        }
        if (this.isReady) {
          await this.derivePassword();
        }
      }
      return success;
    } catch {
      return false;
    }
  }

  /**
   * Login to PqP Network.
   * Opens login in new tab. Returns a promise that resolves when login is detected via focus event.
   */
  async loginToPqpNetwork(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        pqpLogin();

        // Set up a listener for when the window regains focus
        const checkLoginStatus = async () => {
          const isLoggedIn = await isPqpLoggedIn();
          if (isLoggedIn) {
            this._networkLoggedIn = true;
            window.removeEventListener("focus", checkLoginStatus);
            if (this.isReady) {
              await this.derivePassword();
            }
            resolve(true);
          }
        };
        window.addEventListener("focus", checkLoginStatus);

        // Also check immediately after a short delay (in case already logged in)
        setTimeout(() => void checkLoginStatus(), 500);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Derive the master password from the PqP private key using SHA-256.
   */
  async derivePassword(): Promise<string | null> {
    try {
      const privateKey = await localStateRepository.getPrivateKey();
      if (privateKey) {
        this._derivedPassword = await sha256(privateKey);
      }
    } catch {
      // Silent catch
    }
    return this._derivedPassword;
  }

  /**
   * Reset all state (for logout scenarios).
   */
  reset(): void {
    this._googleDriveLoggedIn = false;
    this._networkLoggedIn = false;
    this._userEmail = null;
    this._userName = null;
    this._derivedPassword = null;
  }
}
