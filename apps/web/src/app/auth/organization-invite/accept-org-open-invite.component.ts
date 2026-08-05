import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AcceptFlowService } from "@bitwarden/angular/auth/accept-flow";
import {
  OpenOrgInviteAcceptRenderableErrorKind,
  OpenOrgInviteErrorButton,
  OpenOrgInviteErrorUi,
  getOpenOrgInviteAcceptErrorUi,
  getOpenOrgInviteStatusErrorUi,
} from "@bitwarden/angular/auth/organization-invite";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  OpenOrganizationInvite,
  OpenOrgInviteLinkData,
  OpenOrgInviteStatus,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AnonLayoutWrapperDataService,
  ButtonModule,
  IconModule,
  SpinnerComponent,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Render state for `AcceptOrgOpenInviteComponent`, exactly one active at a time.
 * `Loading` is also the terminal state on non-error paths so the spinner stays
 * visible until navigation tears the view down. `Error` is the shared terminal
 * state for every failure the component surfaces.
 */
export const AcceptOrgOpenInviteViewState = Object.freeze({
  Loading: "loading",
  Error: "error",
} as const);
export type AcceptOrgOpenInviteViewState =
  (typeof AcceptOrgOpenInviteViewState)[keyof typeof AcceptOrgOpenInviteViewState];

@Component({
  templateUrl: "accept-org-open-invite.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, CommonModule, IconModule, SpinnerComponent, I18nPipe],
})
export class AcceptOrgOpenInviteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly acceptFlowService = inject(AcceptFlowService);
  private readonly organizationInviteService = inject(OrganizationInviteService);
  private readonly anonLayoutWrapperDataService = inject(AnonLayoutWrapperDataService);
  private readonly accountService = inject(AccountService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);

  // Template access to the view-state kinds so the `@switch` cases below can compare
  // against symbolic references (`AcceptOrgOpenInviteViewState.Loading`) instead of
  // magic-string literals — same pattern as `LoginComponent` / `LoginUiState`.
  protected readonly AcceptOrgOpenInviteViewState = AcceptOrgOpenInviteViewState;

  protected readonly viewState = signal<AcceptOrgOpenInviteViewState>(
    AcceptOrgOpenInviteViewState.Loading,
  );

  // Resolved (already-interpolated) body copy for the Error view state. Holds a fully
  // rendered string rather than an i18n key so the `email-domain-not-allowed` case can
  // interpolate the user's domain at render time via `i18nService.t(key, domain)`.
  protected readonly errorBody = signal<string>("");

  // Button descriptor rendered below the body in the Error state. `null` outside Error
  // (template only reads it inside the Error `@case`, so the mutual exclusion is enforced
  // by the discriminated view state).
  protected readonly errorButton = signal<OpenOrgInviteErrorButton | null>(null);

  private readonly failedMessage = "openOrgInviteAcceptFailed";

  async ngOnInit() {
    // Sole entry point: `/join/:organizationId/:inviteLinkCode?key=<key>` — the
    // open-org-invite landing URL. Reached either from the user clicking the invite link or
    // from the post-registration deep-link replay (RegistrationFinishComponent
    // reconstructs the same URL after unsealing the sealed-data blob).
    const [params, qParams] = await Promise.all([
      firstValueFrom(this.route.params),
      firstValueFrom(this.route.queryParams),
    ]);

    await this.acceptFlowService.run<OpenOrgInviteLinkData>(
      { ...params, ...qParams },
      {
        failedMessage: this.failedMessage,
        parse: (p) =>
          p?.organizationId && p?.inviteLinkCode && p?.key
            ? {
                organizationId: p.organizationId,
                inviteLinkCode: p.inviteLinkCode,
                inviteKey: p.key,
              }
            : null,
        authedHandler: (linkData) => this.authedHandler(linkData),
        unauthedHandler: (linkData) => this.unauthedHandler(linkData),
        // Scoped to the open key so a malformed open-org-invite URL doesn't wipe a
        // concurrent stashed direct invite.
        onError: () => this.organizationInviteService.clearOpenOrgInvite(),
      },
    );
    // Handlers above have either dispatched a `router.navigate(…)` or transitioned
    // `viewState` to a classified error kind. `Loading` remains on the non-error paths
    // so the spinner covers the pre-navigation frame.
  }

  /**
   * Fetches the open-org-invite status and delegates non-`ok` UI to the shared
   * {@link getOpenOrgInviteStatusErrorUi} mapper so this component and the registration-crossing
   * flow render identical UI for the same status kinds. Sets anon-layout chrome + the
   * body signal + the CTA and returns null so callers short-circuit. `unexpected` maps to a
   * generic-copy descriptor; the raw server detail on the descriptor is logged, not shown.
   */
  private async fetchStatusOrShowError(
    organizationId: string,
    code: string,
    isAuthed: boolean,
  ): Promise<OpenOrgInviteStatus | null> {
    const result = await this.organizationInviteService.getOpenOrgInviteStatus(
      organizationId,
      code,
    );
    if (result.kind === "ok") {
      return result.status;
    }

    if (result.kind === "unexpected") {
      this.logService.error(
        `AcceptOrgOpenInviteComponent: open-org-invite status fetch failed: ${result.errorMessage}`,
      );
    }
    const errorUi = getOpenOrgInviteStatusErrorUi(result.kind, isAuthed);
    this.renderErrorUi(errorUi, this.i18nService.t(errorUi.bodyMessageI18nKey));
    return null;
  }

  private async unauthedHandler(linkData: OpenOrgInviteLinkData): Promise<void> {
    const status = await this.fetchStatusOrShowError(
      linkData.organizationId,
      linkData.inviteLinkCode,
      false,
    );
    if (status == null) {
      return;
    }

    const invite = OpenOrganizationInvite.fromLinkDataAndStatus(linkData, status);
    await this.organizationInviteService.setOrganizationInvite(invite);

    // SSO-required orgs route straight to /sso regardless of whether the user has an
    // existing account (unlike direct invites, the /join URL doesn't carry that hint).
    // The two downstream outcomes:
    //  - New user: server JIT-provisions and accepts into the org as a side effect of
    //    account setup (per-decryption-option: MP set-initial-password, TDE admin-recovery
    //    enrollment, or Key Connector provisioning). The cleanup step of each path drops
    //    both the persisted /join URL and the stashed invite (KC has a known bug where
    //    the stashed invite is not cleared yet), so the guard does not replay and
    //    authedHandler does not re-fire accept.
    //  - Existing user: server rejects SSO login and redirects to /login for MP auth.
    //    After login, the guard replays /join and authedHandler fires acceptOpenOrgInvite.
    if (invite.sso?.required) {
      await this.router.navigate(["/sso"], {
        queryParams: { identifier: invite.sso.orgSsoId },
      });
      return;
    }

    // Non-SSO unauthed: send to registration-start. We have no user identity in the URL,
    // so we can't auto-route to login vs. register — always start at register, and rely on
    // registration-start's existing "Already have an account?" link to route existing users.
    await this.router.navigate(["/signup"]);
  }

  private async authedHandler(linkData: OpenOrgInviteLinkData): Promise<void> {
    // Status is fetched here too (not just in unauthedHandler) because this handler
    // can be reached without going through unauthedHandler first — an authenticated
    // user pasting a `/join/<code>?key=<key>` URL directly into their session has no
    // stashed invite state to hydrate from. The fetch also gives us fresh error
    // surfaces (404 / 400 / no-seats) to render before committing an accept.
    const status = await this.fetchStatusOrShowError(
      linkData.organizationId,
      linkData.inviteLinkCode,
      true,
    );
    if (status == null) {
      return;
    }

    const invite = OpenOrganizationInvite.fromLinkDataAndStatus(linkData, status);
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const result = await this.organizationInviteService.acceptOpenOrgInvite(
      invite,
      activeUserId,
      this.router.url,
    );

    switch (result.kind) {
      case "accepted":
        this.toastService.showToast({
          message: this.i18nService.t("invitationAcceptedDesc"),
          variant: "success",
          timeout: 10000,
        });
        await this.router.navigate(["/"]);
        return;
      case "already-member":
        // Success-adjacent: the outcome the invite would have produced is already true.
        // The toast + navigate home matches the `accepted` path with an `info` variant.
        this.toastService.showToast({
          message: this.i18nService.t("openOrgInviteAcceptAlreadyMember"),
          variant: "info",
          timeout: 10000,
        });
        await this.router.navigate(["/"]);
        return;
      case "stashed-for-mp-policy-detour":
        // Service has already stashed the invite and logged the user out; when they
        // re-authenticate, LoginComponent will replay the invite acceptance.
        return;
      case "email-domain-not-allowed":
        await this.renderEmailDomainNotAllowed();
        return;
      case "recovery-key-mismatch":
        // Security-adjacent condition: invite-bound org key differs from the account-recovery
        // public key returned by the server. User has no direct remediation path, so we
        // fall through to the generic `unexpected` render while emitting a distinct log
        // line.
        this.logService.error(
          "AcceptOrgOpenInviteComponent: recovery-key-mismatch — invite-bound org key differs from account-recovery public key.",
        );
        this.renderMappedError("unexpected");
        return;
      case "unexpected":
        // Non-classified SDK / server / boundary failure. The SDK error text is
        // dev-oriented and unsafe to surface directly; route to the shared state and
        // log the raw message for support.
        this.logService.error(
          "AcceptOrgOpenInviteComponent: unexpected accept-endpoint failure.",
          result.errorMessage,
        );
        this.renderMappedError("unexpected");
        return;
      case "link-not-found":
      case "plan-not-supported":
      case "org-access-revoked":
      case "no-seats":
      case "two-factor-required":
      case "email-not-verified":
      case "single-org-policy-violation-target-org":
      case "single-org-policy-violation-other-org":
      case "auto-confirm-policy-violation-target-org":
      case "auto-confirm-policy-violation-other-org":
      case "provider-users-disallowed":
      case "free-admin-limit-reached":
      case "reset-password-key-required":
        this.renderMappedError(result.kind);
        return;
    }
  }

  /**
   * Renders the shared error surface for an accept-endpoint kind via the
   * {@link getOpenOrgInviteAcceptErrorUi} mapper.
   */
  private renderMappedError(kind: OpenOrgInviteAcceptRenderableErrorKind): void {
    const errorUi = getOpenOrgInviteAcceptErrorUi(kind);
    this.renderErrorUi(errorUi, this.i18nService.t(errorUi.bodyMessageI18nKey));
  }

  /**
   * Renders `email-domain-not-allowed` specifically — the body copy interpolates the
   * user's email domain, which the mapper's return shape does not carry. Domain is
   * derived from the current active account (this kind only fires from `authedHandler`,
   * so the active account is populated).
   */
  private async renderEmailDomainNotAllowed(): Promise<void> {
    const errorUi = getOpenOrgInviteAcceptErrorUi("email-domain-not-allowed");
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    const email = activeAccount?.email ?? "";
    // Fallback to the full email if it lacks an `@` — server-side accept would not have
    // rejected on a domain check if the email were unparseable, so this branch is a
    // defense against unexpected client-side state.
    const domain = email.includes("@") ? email.split("@")[1] : email;
    this.renderErrorUi(errorUi, this.i18nService.t(errorUi.bodyMessageI18nKey, domain));
  }

  /**
   * Shared sink for both the status-endpoint and accept-endpoint mappers — both return
   * `OpenOrgInviteErrorUi`, and both converge on the same view-state transition here.
   */
  private renderErrorUi(errorUi: OpenOrgInviteErrorUi, resolvedBody: string): void {
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData(errorUi.anonLayoutData);
    this.errorBody.set(resolvedBody);
    this.errorButton.set(errorUi.button);
    this.viewState.set(AcceptOrgOpenInviteViewState.Error);
  }

  protected async onButtonClick(): Promise<void> {
    const button = this.errorButton();
    if (button == null) {
      return;
    }
    await this.router.navigate([button.navigateTo]);
  }
}
