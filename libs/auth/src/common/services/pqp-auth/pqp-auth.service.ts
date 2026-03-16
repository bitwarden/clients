import { Injectable } from "@angular/core";
import {
  authenticationService,
  getUserInfo,
  isLoggedIn as isPqpLoggedIn,
  login as pqpLogin,
  ServiceLocator,
} from "@ovrlab/pqp-network";
import type { IdentityProvider } from "@ovrlab/pqp-network";

import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";

import { PasswordLoginCredentials } from "../../models/domain/login-credentials";

export interface PqpAuthState {
  networkLoggedIn: boolean;
  userEmail: string | null;
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

  get networkLoggedIn(): boolean {
    return this._networkLoggedIn;
  }

  get userEmail(): string | null {
    return this._userEmail;
  }

  get isReady(): boolean {
    return this._networkLoggedIn;
  }

  getState(): PqpAuthState {
    return {
      networkLoggedIn: this._networkLoggedIn,
      userEmail: this._userEmail,
      isReady: this.isReady,
    };
  }

  /**
   * Build PasswordLoginCredentials using ephemeral just-in-time password derivation.
   * Password is derived on-demand via withPassword() and never cached.
   *
   * @throws Error if password derivation fails or user not logged in.
   */
  async buildPqpLoginCredentials(
    email: string,
    orgMasterPasswordPolicyOptions?: MasterPasswordPolicyOptions,
  ): Promise<PasswordLoginCredentials> {
    return authenticationService.withPassword(async (derivedPassword) => {
      return new PasswordLoginCredentials(
        email,
        derivedPassword,
        undefined,
        orgMasterPasswordPolicyOptions,
      );
    });
  }

  /**
   * Execute a callback with the ephemeral derived password.
   * Password is derived on-demand, passed to the callback, and discarded after use.
   * Use this when you need the password value directly (e.g., to patch a form).
   *
   * @throws Error if password derivation fails or user not logged in.
   */
  async withDerivedPassword<T>(callback: (password: string) => Promise<T>): Promise<T> {
    return authenticationService.withPassword(callback);
  }

  /**
   * Check if a derived password can be produced (user is logged in with a valid private key).
   * Returns a boolean without exposing the password value.
   */
  async canDerivePassword(): Promise<boolean> {
    try {
      await authenticationService.withPassword(async () => {});
      return true;
    } catch {
      return false;
    }
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
          if (loggedIn) {
            this._userEmail = ipcResult?.email || null;
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
        // Password now derived on-demand when needed (login time)
      } else if (!this._networkLoggedIn) {
        // Clear stale data when logged out
        this._userEmail = null;
      }
    } catch {
      // Reset all state on error to prevent stale data from being reused
      this._networkLoggedIn = false;
      this._userEmail = null;
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
          // Credentials (email) will be fetched later via checkStatus()
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

        // Only mark as logged in if we actually have credentials
        if (this._userEmail) {
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
   * Reset all state (for logout scenarios).
   */
  reset(): void {
    this._networkLoggedIn = false;
    this._userEmail = null;
  }
}
