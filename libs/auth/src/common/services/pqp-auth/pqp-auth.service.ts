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
        // Messaging not available (e.g. background context or desktop) — use IPC or direct API
        const electronIpc = (window as any)?.electron?.ipcRenderer;
        if (electronIpc) {
          const ipcResult = await electronIpc.invoke("PQP_CHECK_STATUS");
          loggedIn = ipcResult?.loggedIn ?? false;
          // Use data from main process (renderer can't access main process storage)
          if (loggedIn && ipcResult?.email) {
            this._userEmail = ipcResult.email;
            this._derivedPassword = ipcResult.derivedPassword || null;
          }
        } else {
          loggedIn = await isPqpLoggedIn();
        }
      }
      this._networkLoggedIn = loggedIn;

      // Fetch or clear user info based on network login state
      // (skip for Electron IPC path — already populated above)
      const electronIpc = (window as any)?.electron?.ipcRenderer;
      if (this._networkLoggedIn && !electronIpc) {
        const userInfo = await getUserInfo();
        if (userInfo) {
          this._userEmail = userInfo.email || null;
        }
        await this.derivePassword();
      } else if (!this._networkLoggedIn) {
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
   * Uses sendWithResponse to wait for the background script to complete the OAuth flow.
   */
  async loginToPqpNetwork(provider: IdentityProvider = "google"): Promise<boolean> {
    const messageType = provider === "microsoft" ? "LOGIN_MICROSOFT" : "LOGIN";

    try {
      const messaging = ServiceLocator.getMessaging();
      const response = await messaging.sendWithResponse(messageType);

      if (response?.success) {
        this._networkLoggedIn = true;
        const userInfo = await getUserInfo();
        if (userInfo) {
          this._userEmail = userInfo.email || null;
        }
        await this.derivePassword();
        return true;
      }
      return false;
    } catch {
      // Fallback for non-extension contexts (desktop Electron)
      try {
        // In Electron, delegate login to the main process via IPC
        // because the identity adapter (OAuth) is configured there, not in the renderer.
        const electronIpc = (window as any)?.electron?.ipcRenderer;
        if (electronIpc) {
          const ipcChannel = provider === "microsoft" ? "PQP_LOGIN_MICROSOFT" : "PQP_LOGIN";
          const ipcResult = await electronIpc.invoke(ipcChannel);
          if (!ipcResult?.success) {
            return false;
          }
          // Match browser extension pattern: return true on login success.
          // Credentials (email, derivedPassword) will be fetched later via checkStatus()
          // when the user clicks "Continue" — by then BOOTSTRAPPING is complete.
          this._networkLoggedIn = true;
          return true;
        } else {
          // Non-Electron fallback: call pqpLogin directly
          await pqpLogin(provider);
        }

        const userInfo = await getUserInfo();
        if (userInfo?.email) {
          this._userEmail = userInfo.email;
        }
        await this.derivePassword();

        // Only mark as logged in if we actually have credentials
        if (this._userEmail && this._derivedPassword) {
          this._networkLoggedIn = true;
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
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
