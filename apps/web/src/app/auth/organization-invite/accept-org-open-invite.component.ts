import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AcceptFlowService } from "@bitwarden/angular/auth/accept-flow";
import { AccountWarning } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  OpenOrganizationInvite,
  OpenOrgInviteStatus,
  OpenOrgInviteUrlParams,
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

  protected readonly loading = signal(true);
  protected readonly noSeats = signal(false);
  protected readonly linkNotFound = signal(false);
  protected readonly planNotSupported = signal(false);
  protected readonly registrationCrossingFailed = signal(false);

  private readonly failedMessage = "openInviteAcceptFailed";

  async ngOnInit() {
    // Two entry points map to this component:
    //   1. `/join/:organizationId/:inviteLinkCode?key=<key>` — direct open-invite landing
    //      with `organizationId`, `inviteLinkCode`, and `inviteKey` (as `?key=`) all
    //      present on the URL.
    //   2. `/join?sealedOpenOrgInviteData=<blob>` — registration-crossing replay from
    //      RegistrationFinishComponent post-login; those three fields live inside the
    //      sealed blob and must be recovered via
    //      `OrganizationInviteService.unsealOpenOrgInvite`.
    const [params, qParams] = await Promise.all([
      firstValueFrom(this.route.params),
      firstValueFrom(this.route.queryParams),
    ]);

    const sealedOpenOrgInviteData =
      typeof qParams.sealedOpenOrgInviteData === "string" && qParams.sealedOpenOrgInviteData !== ""
        ? qParams.sealedOpenOrgInviteData
        : null;
    const hasPathParams = params.organizationId != null && params.inviteLinkCode != null;

    if (sealedOpenOrgInviteData == null && !hasPathParams) {
      // Bare `/join` landing with no context — silent redirect to root. Nothing to accept,
      // no error to surface (user did not attempt anything actionable).
      this.loading.set(false);
      await this.router.navigate(["/"], { replaceUrl: true });
      return;
    }

    if (sealedOpenOrgInviteData != null) {
      await this.registrationCrossingHandler(sealedOpenOrgInviteData);
      this.loading.set(false);
      return;
    }

    await this.acceptFlowService.run<OpenOrgInviteUrlParams>(
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
        authedHandler: (urlParams) => this.authedHandler(urlParams),
        unauthedHandler: (urlParams) => this.unauthedHandler(urlParams),
        // Scoped to the open key so a malformed open-invite URL doesn't wipe a
        // concurrent stashed direct invite.
        onError: () => this.organizationInviteService.clearOpenOrgInvite(),
      },
    );
    this.loading.set(false);
  }

  /**
   * Handles the registration-crossing entry: unseals the blob via the service, and on
   * success hands the recovered invite context to {@link authedHandler} so the accept path
   * is shared with the direct-landing flow. Strips the `sealedOpenOrgInviteData` query
   * param from the URL up-front so back-nav / refresh cannot re-run the crossing after it
   * has been handled once. Every unseal-failure branch — plus any throw from
   * `authedHandler` (accept-endpoint failure, server error, revoked link, etc.) — surfaces
   * the unified registration-crossing error state; the HighEntropySecret entry is cleared
   * on every branch (success or failure) so the crossing is single-use.
   */
  private async registrationCrossingHandler(sealedOpenOrgInviteData: string): Promise<void> {
    // Strip the sealed blob from the URL immediately so this branch cannot re-fire on
    // refresh, back-nav, or history revisit regardless of the outcome below.
    await this.stripSealedOpenOrgInviteDataFromUrl();

    const account = await firstValueFrom(this.accountService.activeAccount$);
    const email = account?.email;
    if (email == null) {
      // The route is gated to authed users, so this is a defensive fallback for the
      // rare "no active account" edge case (e.g. concurrent logout tab).
      this.logService.warning(
        "AcceptOrgOpenInviteComponent: registration-crossing entry hit without an active account.",
      );
      this.showRegistrationCrossingFailed();
      return;
    }

    const result = await this.organizationInviteService.unsealOpenOrgInvite(
      email,
      sealedOpenOrgInviteData,
    );

    switch (result.kind) {
      case "ok": {
        try {
          await this.authedHandler(result.invite);
        } catch (e) {
          // Post-unseal accept-endpoint failure (server error, invite revoked between
          // unseal and accept, network drop, or an unclassified acceptOpenOrgInvite kind
          // that rethrew) — treat as a registration-crossing failure per the unified
          // error copy.
          this.logService.warning(
            "AcceptOrgOpenInviteComponent: accept threw after successful unseal.",
            e,
          );
          this.showRegistrationCrossingFailed();
        }
        // Clear regardless of success/failure — the crossing is complete for this
        // browser and the paired secret has no further use.
        await this.organizationInviteService.clearSealedOpenOrgInviteSecret(email);
        return;
      }
      case "secret-miss": {
        // No HighEntropySecret stored for this email on this origin (cross-device attempt,
        // state wiped, or TTL-swept). Nothing to clear.
        this.logService.warning(
          "AcceptOrgOpenInviteComponent: no HighEntropySecret stored for the active account's email.",
        );
        this.showRegistrationCrossingFailed();
        return;
      }
      case "crypto-failure": {
        // Wrong secret paired with this blob, or the blob has been tampered. The stored
        // HighEntropySecret is now known-bad; clear it defensively.
        this.logService.warning(
          "AcceptOrgOpenInviteComponent: SDK reported a Crypto failure while unsealing.",
        );
        await this.organizationInviteService.clearSealedOpenOrgInviteSecret(email);
        this.showRegistrationCrossingFailed();
        return;
      }
      case "unexpected": {
        // WASM boundary or unclassified throw. Clear defensively; the entry is unlikely
        // to succeed on a retry.
        this.logService.warning(
          `AcceptOrgOpenInviteComponent: unexpected unseal failure: ${result.errorMessage}`,
        );
        await this.organizationInviteService.clearSealedOpenOrgInviteSecret(email);
        this.showRegistrationCrossingFailed();
        return;
      }
    }
  }

  /**
   * Replaces the current URL with the same path minus the `sealedOpenOrgInviteData`
   * query param. `replaceUrl: true` keeps the history entry from growing so back-nav
   * still returns to whatever came before the crossing.
   */
  private async stripSealedOpenOrgInviteDataFromUrl(): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  // TODO: placeholder — pending design. Icon (AccountWarning) and copy
  // (openInviteRegistrationCrossingFailedTitle / openInviteRegistrationCrossingFailedMessage
  // in apps/web/src/locales/en/messages.json) are stand-ins until design provides the final
  // asset + strings. Reused across every registration-crossing failure branch per the
  // unified error copy in the tech breakdown.
  private showRegistrationCrossingFailed(): void {
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: { key: "openInviteRegistrationCrossingFailedTitle" },
      pageIcon: AccountWarning,
    });
    this.registrationCrossingFailed.set(true);
  }

  /**
   * Fetches the open-invite status and dispatches on the service's discriminated result:
   * pushes the matching anon-layout error state and returns null for classified
   * failures so the caller can short-circuit. `unexpected` re-throws into
   * `AcceptFlowService`'s generic error path.
   */
  private async fetchStatusOrShowError(
    organizationId: string,
    code: string,
  ): Promise<OpenOrgInviteStatus | null> {
    const result = await this.organizationInviteService.getOpenOrgInviteStatus(
      organizationId,
      code,
    );
    switch (result.kind) {
      case "ok":
        return result.status;
      case "not-found":
        // TODO: placeholder — pending design. Icon (AccountWarning) and copy
        // (openInviteNotFoundTitle / openInviteNotFoundMessage in
        // apps/web/src/locales/en/messages.json) are stand-ins until design
        // provides the final asset + strings. Server response for 404 carries
        // no org name, so copy stays generic.
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageTitle: { key: "openInviteNotFoundTitle" },
          pageIcon: AccountWarning,
        });
        this.linkNotFound.set(true);
        return null;
      case "plan-not-supported":
        // TODO: placeholder — pending design. Icon (AccountWarning) and copy
        // (openInvitePlanNotSupportedTitle / openInvitePlanNotSupportedMessage
        // in apps/web/src/locales/en/messages.json) are stand-ins until design
        // provides the final asset + strings. `organizationName` is available on
        // this result kind and should feed the title once design approves the
        // interpolated copy.
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageTitle: { key: "openInvitePlanNotSupportedTitle" },
          pageIcon: AccountWarning,
        });
        this.planNotSupported.set(true);
        return null;
      case "no-seats":
        // TODO: placeholder — pending design. `organizationName` is available on
        // this result kind and should feed the title once design approves the
        // interpolated copy.
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageTitle: { key: "openInviteNoSeatsTitle" },
          pageIcon: AccountWarning,
        });
        this.noSeats.set(true);
        return null;
      case "unexpected":
        throw new Error(result.errorMessage);
    }
  }

  private async unauthedHandler(urlParams: OpenOrgInviteUrlParams): Promise<void> {
    const status = await this.fetchStatusOrShowError(
      urlParams.organizationId,
      urlParams.inviteLinkCode,
    );
    if (status == null) {
      return;
    }

    const invite = OpenOrganizationInvite.fromUrlParamsAndStatus(urlParams, status);
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

  private async authedHandler(urlParams: OpenOrgInviteUrlParams): Promise<void> {
    // Status is fetched here too (not just in unauthedHandler) because this handler
    // can be reached without going through unauthedHandler first — an authenticated
    // user pasting a `/join/<code>?key=<key>` URL directly into their session has no
    // stashed invite state to hydrate from. The fetch also gives us fresh error
    // surfaces (404 / 400 / no-seats) to render before committing an accept.
    const status = await this.fetchStatusOrShowError(
      urlParams.organizationId,
      urlParams.inviteLinkCode,
    );
    if (status == null) {
      return;
    }

    const invite = OpenOrganizationInvite.fromUrlParamsAndStatus(urlParams, status);
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
        // TODO: placeholder — pending design. Reuses the same not-found stand-ins as
        // fetchStatusOrShowError; final asset + copy land together.
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageTitle: { key: "openInviteNotFoundTitle" },
          pageIcon: AccountWarning,
        });
        this.linkNotFound.set(true);
        return;
      case "plan-not-supported":
        // TODO: placeholder — pending design. Reuses the plan-not-supported stand-ins.
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageTitle: { key: "openInvitePlanNotSupportedTitle" },
          pageIcon: AccountWarning,
        });
        this.planNotSupported.set(true);
        return;
      case "no-seats":
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageTitle: { key: "openInviteNoSeatsTitle" },
          pageIcon: AccountWarning,
        });
        this.noSeats.set(true);
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
        // TODO: dedicated UI per kind pending design. Until then, surface via the
        // AcceptFlowService generic error path so the user sees the failedMessage toast.
        // Note: `already-member` is success-adjacent and probably wants distinct UX
        // (toast + navigate home) but the treatment is design's call.
        throw new Error(`Open invite accept rejected: ${result.kind}`);
      case "unexpected":
        throw new Error(result.errorMessage);
    }
  }
}
