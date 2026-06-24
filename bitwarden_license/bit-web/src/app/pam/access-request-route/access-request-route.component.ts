import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { filter, lastValueFrom } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import {
  AccessDeciderKind,
  AccessDecisionVerdict,
  AccessLeaseStatus,
  AccessRequestStatus,
  formatRemaining,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeComponent,
  ButtonModule,
  DialogService,
  IconModule,
  NoItemsModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  durationLabel,
  exactWindow,
  reasonText,
  relativeStart,
} from "../approver-inbox/approval-row";
import { DecideDialogComponent } from "../approver-inbox/decide-dialog.component";
import { historyDisplayStatus } from "../my-access-requests/my-request-row";

import { AccessRequestDetailService } from "./access-request-detail.service";

/**
 * The dedicated, shareable page for a single access request (`/pam/requests/:id`).
 *
 * Reached by a link an approver/requester can hand to a colleague, or by clicking a request row in
 * the inbox / "My requests" / audit-log views. Renders the request's metadata, lease status, and
 * decision log, and offers inline Approve/Deny to an eligible approver (read-only otherwise), plus
 * the requester's Start/Cancel and the holder's End-access actions where applicable.
 *
 * The page is reached through `authGuard` + `deepLinkGuard` + the PAM feature flag, so the user is
 * authenticated and unlocked here. Data, name resolution, and mutations live in the page-scoped
 * {@link AccessRequestDetailService}; this component owns only the view (the live countdown clock and
 * the action affordances).
 */
@Component({
  selector: "app-pam-access-request-route",
  templateUrl: "./access-request-route.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AccessRequestDetailService],
  imports: [
    CommonModule,
    RouterModule,
    I18nPipe,
    HeaderModule,
    BadgeComponent,
    ButtonModule,
    IconModule,
    IconComponent,
    NoItemsModule,
    SectionComponent,
    SectionHeaderComponent,
    TooltipDirective,
    TypographyModule,
  ],
})
export class AccessRequestRouteComponent implements OnInit {
  private readonly detail = inject(AccessRequestDetailService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  protected readonly request = toSignal(this.detail.request$, { initialValue: null });
  protected readonly loading = toSignal(this.detail.loading$, { initialValue: true });
  protected readonly notFound = toSignal(this.detail.notFound$, { initialValue: false });
  protected readonly loadError = toSignal(this.detail.loadError$, { initialValue: null });
  protected readonly canDecide = toSignal(this.detail.canApprove$, { initialValue: false });
  protected readonly currentUserId = toSignal(this.detail.currentUserId$, { initialValue: null });
  private readonly cipherById = toSignal(this.detail.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  /** Ticks once a second so the lease / redemption countdowns stay live. */
  private readonly nowMs = signal(Date.now());

  /** Per-action in-flight flags (prevent double-submit and drive button spinners). */
  protected readonly deciding = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly starting = signal(false);
  protected readonly ending = signal(false);

  protected readonly badge = computed(() => {
    const request = this.request();
    return request == null ? null : historyDisplayStatus(request);
  });

  protected readonly duration = computed(() => {
    const request = this.request();
    return request == null ? null : durationLabel(request);
  });

  protected readonly start = computed(() => {
    const request = this.request();
    return request == null ? null : relativeStart(request, new Date(this.nowMs()));
  });

  protected readonly exactWindowText = computed(() => {
    const request = this.request();
    return request == null ? "" : exactWindow(request);
  });

  protected readonly reason = computed(() => {
    const request = this.request();
    return request == null ? null : reasonText(request);
  });

  protected readonly requesterDisplay = computed(() => {
    const request = this.request();
    return request == null
      ? null
      : request.requesterName || request.requesterEmail || request.requesterId;
  });

  /** The recorded decisions as a view model, oldest first. */
  protected readonly decisions = computed(() => {
    const request = this.request();
    if (request == null) {
      return [];
    }
    return request.decisions.map((decision) => ({
      automatic: decision.deciderKind === AccessDeciderKind.Automatic,
      who: decision.name || decision.email || decision.id,
      approved: decision.verdict === AccessDecisionVerdict.Approve,
      comment: decision.comment,
      decidedAt: new Date(decision.decidedAt),
    }));
  });

  protected readonly leaseActive = computed(
    () => this.request()?.producedLeaseStatus === AccessLeaseStatus.Active,
  );

  /** A live "ends in X" label while the produced lease is active and its window is still open. */
  protected readonly leaseRemaining = computed(() => {
    const request = this.request();
    if (request == null || !this.leaseActive() || request.requestedNotAfter == null) {
      return null;
    }
    const remaining = Date.parse(request.requestedNotAfter) - this.nowMs();
    return remaining > 0 ? formatRemaining(remaining) : null;
  });

  /** A live "activate within X" label for an approved on-demand request. */
  protected readonly redemptionRemaining = computed(() => {
    const request = this.request();
    if (
      request == null ||
      request.status !== AccessRequestStatus.Approved ||
      request.activationDeadline == null
    ) {
      return null;
    }
    return formatRemaining(Date.parse(request.activationDeadline) - this.nowMs());
  });

  protected readonly isRequester = computed(() => {
    const request = this.request();
    const userId = this.currentUserId();
    return request != null && userId != null && request.requesterId === userId;
  });

  /** The requester can start an approved request while its window can still produce access. */
  protected readonly canStart = computed(() => {
    const request = this.request();
    return (
      request != null &&
      this.isRequester() &&
      request.status === AccessRequestStatus.Approved &&
      (request.requestedNotAfter == null || Date.parse(request.requestedNotAfter) > this.nowMs())
    );
  });

  /** The requester can withdraw a pending request, or an approved one whose window has not lapsed. */
  protected readonly canCancel = computed(() => {
    const request = this.request();
    if (request == null || !this.isRequester()) {
      return false;
    }
    if (request.status === AccessRequestStatus.Pending) {
      return true;
    }
    return (
      request.status === AccessRequestStatus.Approved &&
      (request.requestedNotAfter == null || Date.parse(request.requestedNotAfter) > this.nowMs())
    );
  });

  /** The holder can end their own active lease early. */
  protected readonly canEndLease = computed(() => this.isRequester() && this.leaseActive());

  ngOnInit(): void {
    // Keep the countdown clock outside the Angular zone so a periodic in-zone timer never blocks
    // `whenStable()` for tests/hosts; the signal write still drives change detection.
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => this.nowMs.set(Date.now()), 1000);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    });

    // A non-404 load failure (404 is the not-found state) surfaces as a toast.
    this.detail.loadError$
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamAccessRequestLoadError"),
        });
      });
  }

  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.cipherById().get(cipherId);
  }

  protected readonly approve = AccessDecisionVerdict.Approve;
  protected readonly deny = AccessDecisionVerdict.Deny;

  /** Confirm a verdict in the shared dialog, then submit it and toast the outcome. */
  protected async openDecision(verdict: AccessDecisionVerdict): Promise<void> {
    const request = this.request();
    if (request == null || this.deciding()) {
      return;
    }
    const ref = DecideDialogComponent.open(this.dialogService, {
      data: { verdict, request, now: new Date(this.nowMs()) },
    });
    const result = await lastValueFrom(ref.closed);
    // Only an explicit confirm carries `confirmed`; any other dismissal must not decide.
    if (!result?.confirmed) {
      return;
    }
    this.deciding.set(true);
    try {
      await this.detail.decide(verdict, result.comment);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          verdict === AccessDecisionVerdict.Approve
            ? "pamInboxApprovedToast"
            : "pamInboxDeniedToast",
        ),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxDecisionFailed"),
      });
    } finally {
      this.deciding.set(false);
    }
  }

  protected async cancel(): Promise<void> {
    if (!this.canCancel() || this.cancelling()) {
      return;
    }
    this.cancelling.set(true);
    try {
      await this.detail.cancel();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamMyRequestsCancelSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamMyRequestsCancelError"),
      });
    } finally {
      this.cancelling.set(false);
    }
  }

  protected async startAccess(): Promise<void> {
    if (!this.canStart() || this.starting()) {
      return;
    }
    this.starting.set(true);
    try {
      await this.detail.activate();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      // A taken single-active-lease slot or an org-wide freeze surfaces here; the approved request
      // stays activatable for a manual retry.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamStartLeaseError"),
      });
    } finally {
      this.starting.set(false);
    }
  }

  protected async endLease(): Promise<void> {
    const leaseId = this.request()?.producedLeaseId;
    if (leaseId == null || !this.canEndLease() || this.ending()) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamEndLeaseTitle" },
      content: { key: "pamEndLeaseConfirm" },
      acceptButtonText: { key: "pamEndLeaseButton" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    this.ending.set(true);
    try {
      await this.detail.endLease(leaseId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamEndLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    } finally {
      this.ending.set(false);
    }
  }
}
