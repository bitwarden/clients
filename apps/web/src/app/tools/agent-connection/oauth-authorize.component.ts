import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { AgentAccessPskGenerator } from "@bitwarden/common/tools/agent-connection/abstractions/agent-access-psk-generator.abstraction";
import { AgentConnectionRequest } from "@bitwarden/common/tools/agent-connection/models/request/agent-connection.request";
import { AgentConnectionApiService } from "@bitwarden/common/tools/agent-connection/services/agent-connection-api.service.abstraction";
import { AgentConnectionService } from "@bitwarden/common/tools/agent-connection/services/agent-connection.service.abstraction";
import { ToastService } from "@bitwarden/components";

import { SharedModule } from "../../shared";

import { AuthorizeContext, OAuthBrokerApiService } from "./services/oauth-broker-api.service";
import { OAuthBrokerStateService } from "./services/oauth-broker-state.service";

/**
 * "Login with Bitwarden" consent screen. Identity redirects a pre-registered partner's
 * `/connect/authorize` request here (hash route `/#/oauth/authorize?returnUrl=...`). The user must be
 * authenticated (route guards) so the master-password-derived user key is available to wrap the PSK.
 *
 * On approval it: (1) generates the plaintext agent-access PSK, (2) wraps it under the user key and
 * stores the ciphertext via `POST /agent-connections`, (3) records consent via the API (which mints a
 * single-use token), and (4) navigates to Identity's consent callback, which grants consent and
 * resumes the authorize request — issuing the code to the registered `redirect_uri` (the completion
 * page). The plaintext PSK never leaves the client and is never sent to the Bitwarden server.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [SharedModule],
  templateUrl: "oauth-authorize.component.html",
})
export class OAuthAuthorizeComponent implements OnInit {
  protected loading = true;
  protected submitting = false;
  protected context?: AuthorizeContext;

  /** The `returnUrl` of the pending authorize request, from Identity's login redirect. */
  private returnUrl = "";
  /** The OAuth `state`, parsed out of `returnUrl` (Identity does not pass it as a top-level param). */
  private state = "";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private brokerApiService: OAuthBrokerApiService,
    private brokerStateService: OAuthBrokerStateService,
    private pskGenerator: AgentAccessPskGenerator,
    private agentConnectionService: AgentConnectionService,
    private agentConnectionApiService: AgentConnectionApiService,
    private accountService: AccountService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private changeDetectorRef: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const params = await firstValueFrom(this.route.queryParams);
      this.returnUrl = params.returnUrl ?? "";
      this.state = this.parseState(this.returnUrl);
      this.context = await this.brokerApiService.getAuthorizeContext(this.returnUrl);
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("loginWithBitwardenRequestInvalid"),
      });
    } finally {
      this.loading = false;
      // getAuthorizeContext uses native fetch, which can resolve outside Angular's zone, so force a
      // change-detection pass to render the resolved consent state.
      this.changeDetectorRef.detectChanges();
    }
  }

  /** Maps a raw OIDC scope to a friendly, localized description, falling back to the raw value. */
  protected scopeLabel(scope: string): string {
    const key = {
      openid: "loginWithBitwardenScopeOpenid",
      profile: "loginWithBitwardenScopeProfile",
      email: "loginWithBitwardenScopeEmail",
    }[scope];
    return key != null ? this.i18nService.t(key) : scope;
  }

  /** Extracts the `state` value from the embedded authorize query inside `returnUrl`. */
  private parseState(returnUrl: string): string {
    const queryIndex = returnUrl.indexOf("?");
    if (queryIndex < 0) {
      return "";
    }
    return new URLSearchParams(returnUrl.substring(queryIndex + 1)).get("state") ?? "";
  }

  async approve(): Promise<void> {
    if (this.context == null || this.submitting) {
      return;
    }
    this.submitting = true;
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

      // Generate the PSK only after consent; the plaintext stays client-side.
      const psk = await this.pskGenerator.generate();

      // Store the user-key-encrypted PSK (ciphertext only) on the account, bound to the partner.
      const connection = await this.agentConnectionService.encrypt(
        this.context.clientId,
        this.context.clientName,
        psk,
        userId,
      );
      await this.agentConnectionApiService.post(new AgentConnectionRequest(connection));

      // Record consent via the API (mints a single-use token). No PSK is sent.
      const { token } = await this.brokerApiService.postConsent(this.returnUrl);

      // Hand the plaintext PSK (and the agent's loopback, when the server provides it) to the
      // completion connector; survives the navigation via sessionStorage.
      this.brokerStateService.set(this.state, psk, this.context.agentRedirectUri);

      // Identity grants consent and resumes the authorize request, issuing the code to the
      // registered redirect_uri (the completion page).
      window.location.href = await this.brokerApiService.buildConsentCallbackUrl(
        token,
        this.returnUrl,
      );
    } catch {
      this.submitting = false;
      this.brokerStateService.clear(this.state);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("loginWithBitwardenConsentFailed"),
      });
      this.changeDetectorRef.detectChanges();
    }
  }

  async deny(): Promise<void> {
    this.brokerStateService.clear(this.state);
    await this.router.navigate(["/"]);
  }
}
