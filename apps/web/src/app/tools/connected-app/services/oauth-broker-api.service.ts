import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";

/** The partner app + requested scopes for a pending authorize request, shown on the consent screen. */
export interface AuthorizeContext {
  /** The registered partner's OAuth client id (e.g. `partner.acme`) — bound to the ConnectedApp. */
  clientId: string;
  clientName: string;
  scopes: string[];
  /**
   * The agent's loopback redirect the completion connector forwards the PSK to, validated server-side
   * against the partner's allow-list. Optional — absent when the partner has no registered agent
   * redirect, in which case the completion connector shows "complete" instead of forwarding.
   */
  agentRedirectUri?: string;
}

/** Response of the API consent endpoint — the single-use token handed to Identity's consent callback. */
interface ConsentResponse {
  token: string;
}

/**
 * Talks to the "Login with Bitwarden" OIDC endpoints that drive the web-vault consent flow. They are
 * split across two servers:
 * - Identity (`src/Identity`) exposes `GET /oidc/AuthorizeContext` and the `GET /oidc/ConsentCallback`
 *   the browser is finally sent to.
 * - The API (`src/Api`) exposes the authenticated `POST /oidc/consent`, which mints the single-use
 *   consent token.
 *
 * No PSK is ever sent to any of these endpoints — Identity only records consent.
 */
@Injectable({ providedIn: "root" })
export class OAuthBrokerApiService {
  constructor(
    private environmentService: EnvironmentService,
    private apiService: ApiService,
  ) {}

  /** Fetches the partner app id/name + requested scopes for the pending authorize request. */
  async getAuthorizeContext(returnUrl: string): Promise<AuthorizeContext> {
    const identityUrl = await this.getIdentityUrl();
    const response = await fetch(
      `${identityUrl}/oidc/AuthorizeContext?returnUrl=${encodeURIComponent(returnUrl)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`Authorize context request failed with status ${response.status}`);
    }
    const body = await response.json();
    return {
      clientId: body.clientId,
      clientName: body.clientName,
      scopes: body.scopes ?? [],
      agentRedirectUri: body.agentRedirectUri,
    };
  }

  /**
   * Records the user's consent for the pending authorize request (authenticated API call) and returns
   * the single-use token to hand to Identity's consent callback. No PSK is sent.
   */
  async postConsent(returnUrl: string): Promise<{ token: string }> {
    const response = (await this.apiService.send(
      "POST",
      "/oidc/consent",
      { returnUrl },
      true,
      true,
    )) as ConsentResponse;
    return { token: response.token };
  }

  /**
   * The Identity URL the browser is navigated to after consent; it signs the user in, grants consent,
   * and resumes the original authorize request (which issues the code to the registered redirect URI).
   */
  async buildConsentCallbackUrl(token: string, returnUrl: string): Promise<string> {
    const identityUrl = await this.getIdentityUrl();
    return `${identityUrl}/oidc/ConsentCallback?token=${encodeURIComponent(token)}&returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  private async getIdentityUrl(): Promise<string> {
    return (await firstValueFrom(this.environmentService.environment$)).getIdentityUrl();
  }
}
