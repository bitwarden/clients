import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AcceptFlowService } from "@bitwarden/angular/auth/accept-flow";
import { openOrgInviteStatusErrorUi } from "@bitwarden/angular/auth/organization-invite";
import { AccountWarning } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  OpenOrganizationInvite,
  OpenOrgInviteStatus,
  OpenOrgInviteLinkData,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AnonLayoutWrapperDataService,
  IconModule,
  SpinnerComponent,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Discriminated render state for `AcceptOrgOpenInviteComponent`. Exactly one kind is
 * active at a time — the template `@switch (viewState())` renders the matching branch,
 * so mutual exclusion between spinner and each classified error is enforced by the type
 * rather than by parallel boolean flags.
 *
 * `Loading` is also the terminal state on every non-error path: the component immediately
 * dispatches a `router.navigate(…)` (or gets replaced by a logout-driven redirect for
 * `stashed-for-mp-policy-detour`), so keeping the spinner up until Angular tears the view
 * down avoids a blank frame between init and navigation.
 */
export const AcceptOrgOpenInviteViewState = Object.freeze({
  Loading: "loading",
  NotFound: "not-found",
  NoSeats: "no-seats",
  PlanNotSupported: "plan-not-supported",
  AcceptFailed: "accept-failed",
} as const);
export type AcceptOrgOpenInviteViewState =
  (typeof AcceptOrgOpenInviteViewState)[keyof typeof AcceptOrgOpenInviteViewState];

@Component({
  templateUrl: "accept-org-open-invite.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconModule, SpinnerComponent, I18nPipe],
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

  private readonly failedMessage = "openInviteAcceptFailed";

  async ngOnInit() {
    // Sole entry point: `/join/:organizationId/:inviteLinkCode?key=<key>` — the direct
    // open-invite landing URL. Reached either from the user clicking the invite link or
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
        // Scoped to the open key so a malformed open-invite URL doesn't wipe a
        // concurrent stashed direct invite.
        onError: () => this.organizationInviteService.clearOpenOrgInvite(),
      },
    );
    // Handlers above have either dispatched a `router.navigate(…)` or transitioned
    // `viewState` to a classified error kind. `Loading` remains on the non-error paths
    // so the spinner covers the pre-navigation frame.
  }

  /**
   * Fetches the open-invite status and delegates classified-failure anon-layout data to
   * the shared {@link openOrgInviteStatusErrorUi} mapper so this component and the
   * registration-crossing flow render identical UI for the same status kinds. Sets the
   * matching per-kind signal for the template body branch and returns null so callers
   * short-circuit. `unexpected` re-throws via the mapper into `AcceptFlowService`'s
   * generic error path.
   */
  private async fetchStatusOrShowError(
    organizationId: string,
    code: string,
  ): Promise<OpenOrgInviteStatus | null> {
    const result = await this.organizationInviteService.getOpenOrgInviteStatus(
      organizationId,
      code,
    );
    if (result.kind === "ok") {
      return result.status;
    }

    const errorUi = openOrgInviteStatusErrorUi(result);
    // `errorUi` is only null when `result.kind === 'ok'`, which is handled above; the
    // narrowing here is defensive against a future kind being added without mapper support.
    if (errorUi == null) {
      return null;
    }
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData(errorUi.anonLayoutData);
    switch (result.kind) {
      case "not-found":
        this.viewState.set(AcceptOrgOpenInviteViewState.NotFound);
        break;
      case "plan-not-supported":
        this.viewState.set(AcceptOrgOpenInviteViewState.PlanNotSupported);
        break;
      case "no-seats":
        this.viewState.set(AcceptOrgOpenInviteViewState.NoSeats);
        break;
    }
    return null;
  }

  private async unauthedHandler(linkData: OpenOrgInviteLinkData): Promise<void> {
    const status = await this.fetchStatusOrShowError(
      linkData.organizationId,
      linkData.inviteLinkCode,
    );
    if (status == null) {
      return;
    }

    const invite = OpenOrganizationInvite.fromLinkDataAndStatus(linkData, status);
    await this.organizationInviteService.setOrganizationInvite(invite);

    // SSO-required orgs route straight to /sso. The deepLinkGuard() on this route
    // persisted the inbound URL on the initial unauth visit; once the user reaches
    // Unlocked post-SSO + JIT account setup, the guard replays
    // /#/join/{code}?key={key} and authedHandler fires accept.
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
    );
    if (status == null) {
      return;
    }

    const invite = OpenOrganizationInvite.fromLinkDataAndStatus(linkData, status);
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const result = await this.organizationInviteService.acceptOpenOrgInvite(invite, activeUserId);

    switch (result.kind) {
      case "accepted":
        this.toastService.showToast({
          message: this.i18nService.t("invitationAcceptedDesc"),
          variant: "success",
          timeout: 10000,
        });
        await this.router.navigate(["/"]);
        return;
      case "stashed-for-mp-policy-detour":
        // Service has already stashed the invite and logged the user out; when they
        // re-authenticate, LoginComponent will replay the invite acceptance.
        return;
      case "link-not-found":
        // TODO: placeholder — pending design. Reuses the same `openInvite*Title` +
        // `AccountWarning` stand-ins as the fetchStatusOrShowError path; final asset
        // + copy for the not-found state will land together across both paths.
        this.showNotFound();
        return;
      case "plan-not-supported":
        // TODO: placeholder — pending design. Reuses the plan-not-supported stand-ins.
        // `openInvitePlanNotSupportedTitle` should feed off `organizationName` once
        // design approves the interpolated copy (see mapper TODO for the status path).
        this.showPlanNotSupported();
        return;
      case "no-seats":
        // TODO: placeholder — pending design. `openInviteNoSeatsTitle` should feed off
        // `organizationName` once design approves the interpolated copy (see mapper
        // TODO for the status path).
        this.showNoSeats();
        return;
      case "already-member":
      case "email-domain-not-allowed":
      case "org-access-revoked":
      case "two-factor-required":
      case "single-org-policy-violation":
      case "auto-confirm-policy-violation":
      case "provider-user":
      case "free-admin-limit":
      case "reset-password-key-required":
      case "recovery-key-mismatch":
        // TODO: dedicated UI per kind pending design. All fold-through to the shared
        // "we couldn't accept" state for MVP — per-kind copy is a design follow-up.
        // Notes: `already-member` is success-adjacent and probably wants distinct UX
        // (toast + navigate home); `recovery-key-mismatch` is a specific security
        // condition (invite-bound org key differs from the account-recovery public
        // key) and may warrant distinct copy too.
        this.showAcceptFailed();
        return;
      case "unexpected":
        // Non-classified SDK / server / boundary failure. The SDK error text is
        // dev-oriented and unsafe to surface directly; route to the shared state and
        // log the raw message for support.
        this.logService.warning(
          "AcceptOrgOpenInviteComponent: unexpected accept-endpoint failure.",
          result.errorMessage,
        );
        this.showAcceptFailed();
        return;
    }
  }

  /**
   * Sets the anon-layout page title + icon and transitions `viewState` to the given
   * error kind. Central helper so every classified-error site (from `authedHandler` and
   * `fetchStatusOrShowError`) sets both the layout chrome and the view state in one call.
   */
  private showError(anonLayoutTitleKey: string, kind: AcceptOrgOpenInviteViewState): void {
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: { key: anonLayoutTitleKey },
      pageIcon: AccountWarning,
    });
    this.viewState.set(kind);
  }

  // TODO: placeholders — pending design. Anon-layout `openInvite*Title` copy + the
  // `AccountWarning` icon are stand-ins until design provides finals. Kept as thin
  // wrappers so call sites read as intent, and so a future distinct-per-kind design pass
  // only edits this file (not each caller). Per-kind follow-ups (org-name interpolation
  // for plan-not-supported and no-seats) are noted on the mapper and the authedHandler
  // call sites — they should land together across both the status and accept paths.
  private showNotFound(): void {
    this.showError("openInviteNotFoundTitle", AcceptOrgOpenInviteViewState.NotFound);
  }

  private showPlanNotSupported(): void {
    this.showError(
      "openInvitePlanNotSupportedTitle",
      AcceptOrgOpenInviteViewState.PlanNotSupported,
    );
  }

  private showNoSeats(): void {
    this.showError("openInviteNoSeatsTitle", AcceptOrgOpenInviteViewState.NoSeats);
  }

  // TODO: needs finalization. This is the catch-all state for classified accept-endpoint
  // rejections (already-member, email-domain-not-allowed, org-access-revoked, 2FA-required,
  // etc.) — see the `authedHandler` switch for the full list. Several of those probably
  // want distinct UX once design lands (`already-member` is success-adjacent;
  // `recovery-key-mismatch` is a specific security condition), which will splinter this
  // helper into a handful of per-kind ones.
  private showAcceptFailed(): void {
    this.showError("openInviteAcceptFailedTitle", AcceptOrgOpenInviteViewState.AcceptFailed);
  }
}
