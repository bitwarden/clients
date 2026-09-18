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
import { filter, firstValueFrom } from "rxjs";

import { NoResults } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeComponent,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  StatusLockupComponent,
  SvgComponent,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  AccessRequestView,
  activateAccessErrorMessageKey,
  durationLabel,
  exactWindow,
  humanApprover,
  reasonText,
  relativeStart,
} from "../..";
import type { AccessDecisionVerdict } from "../../abstractions/access-lease";
import { AccessStateBadgeComponent } from "../../access-state-badge/access-state-badge.component";
import { DecideDialogComponent } from "../../approvals/decide-dialog/decide-dialog.component";
import { isLiveManagedLease } from "../../approvals/managed-lease-row";
import { RemainingTimePipe } from "../../date/remaining-time.pipe";
import { RequestSummaryComponent } from "../../request-summary/request-summary.component";
import { SummaryFieldComponent } from "../../request-summary/summary-field.component";
import { emptyResolvedNames, organizationNameFor } from "../access-name-resolver.service";
import { historyDisplayStatus } from "../my-access-row";

import { AccessRequestDetailService } from "./access-request-detail.service";

/**
 * i18n keys for a decision-log entry's outcome. A Deny recorded on a request that did not end
 * Denied is the lease ending (self-end or operator revoke), not a denial — mirroring the
 * historical-status derivation in `../my-access-row`.
 */
const DECISION_LABEL_KEYS = {
  approved: "pamStatusApproved",
  denied: "pamStatusDenied",
  endedByHolder: "pamAuditKindLeaseEndedByHolder",
  revoked: "pamAuditKindLeaseRevoked",
} as const;

export type AccessRequestDialogParams = {
  /**
   * Handed in rather than injected: `DialogService` builds the dialog's injector from the root
   * one, so a provider scoped to the opening route isn't reachable from inside here.
   */
  detail: AccessRequestDetailService;
};

/**
 * One access request, opened over the access-requests shell by the `/pam/requests/:id` route;
 * the host route owns the URL and close navigation, this dialog owns the view.
 *
 * The same link reaches the requester and the request's approvers, so the footer follows the
 * viewer: Start / Cancel / End for the requester, Approve / Deny, Withdraw approval or Revoke
 * for an approver. Neither side ever sees the other's actions.
 *
 * Data, name resolution, and mutations live in {@link AccessRequestDetailService}.
 */
@Component({
  selector: "pam-access-request-dialog",
  templateUrl: "./access-request-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    I18nPipe,
    AccessStateBadgeComponent,
    BadgeComponent,
    ButtonModule,
    DialogModule,
    StatusLockupComponent,
    SvgComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    RemainingTimePipe,
    RequestSummaryComponent,
    SummaryFieldComponent,
  ],
})
export class AccessRequestDialogComponent implements OnInit {
  protected readonly noResultsSvg = NoResults;

  private readonly detail = inject<AccessRequestDialogParams>(DIALOG_DATA).detail;
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
  private readonly cipherById = toSignal(this.detail.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });
  private readonly names = toSignal(this.detail.names$, { initialValue: emptyResolvedNames() });
  private readonly viewer = toSignal(this.detail.viewer$, { initialValue: null });
  private readonly approvalRow = toSignal(this.detail.approvalRow$, { initialValue: null });
  private readonly managed = toSignal(this.detail.managed$, { initialValue: false });
  private readonly isRequester = computed(() => this.viewer() === "requester");
  private readonly isApprover = computed(() => this.viewer() === "approver");

  /** Cipher name resolved from local vault state; falls back to the raw id. */
  protected readonly cipherName = computed(() => {
    const request = this.request();
    return request == null
      ? null
      : (this.names().cipherNameById.get(cipherId(request)) ?? cipherId(request));
  });

  /** Collection name resolved from local vault state, null when unknown. */
  protected readonly collectionName = computed(() => {
    const request = this.request();
    return request == null
      ? null
      : (this.names().collectionNameById.get(collectionId(request)) ?? null);
  });

  /** Owning organization's name resolved from the caller's membership, null when unknown. */
  protected readonly organizationName = computed(() => {
    const request = this.request();
    return request == null ? null : organizationNameFor(request, this.names());
  });

  /** Ticks every second so the lease / redemption countdowns stay live. */
  protected readonly nowMs = signal(Date.now());

  /** Per-action in-flight flags (prevent double-submit and drive button spinners). */
  protected readonly cancelling = signal(false);
  protected readonly starting = signal(false);
  protected readonly ending = signal(false);
  protected readonly deciding = signal(false);
  protected readonly withdrawing = signal(false);
  protected readonly revoking = signal(false);

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
      : request.requesterName || request.requesterEmail || uuidAsString(request.requesterId);
  });

  protected readonly requesterEmail = computed(() => this.request()?.requesterEmail ?? null);

  /** The recorded decisions as a view model, oldest first (as the server returns them). */
  protected readonly decisions = computed(() => {
    const request = this.request();
    if (request == null) {
      return [];
    }
    return request.decisions.map((decision) => {
      const approver = humanApprover(decision);
      const denied = decision.verdict === "deny";
      // A Deny on a request that didn't end Denied is the lease ending; revoke/self-end stores
      // its reason as Deny.
      const leaseEnd = denied && request.status !== "denied";
      const outcome = !denied
        ? "approved"
        : !leaseEnd
          ? "denied"
          : approver?.id === request.requesterId
            ? "endedByHolder"
            : "revoked";
      return {
        automatic: decision.decider === "automatic",
        who:
          approver?.name ||
          approver?.email ||
          (approver?.id == null ? "" : uuidAsString(approver.id)),
        outcome,
        labelKey: DECISION_LABEL_KEYS[outcome],
        comment: decision.comment,
        decidedAt: decision.decidedAt,
      };
    });
  });

  protected readonly leaseActive = computed(() => this.request()?.producedLeaseStatus === "active");

  /**
   * Whether to show the live "ends in X" countdown: the produced lease is active and its window
   * is still open. The countdown itself is rendered via the `remainingTime` pipe in the template.
   */
  protected readonly showLeaseRemaining = computed(() => {
    const request = this.request();
    return (
      request != null && this.leaseActive() && Date.parse(request.leaseNotAfter) > this.nowMs()
    );
  });

  /** The requester can start an approved request while its window can still produce access. */
  protected readonly canStart = computed(() => {
    const request = this.request();
    return (
      request != null &&
      this.isRequester() &&
      request.status === "approved" &&
      request.producedLeaseId == null &&
      Date.parse(request.leaseNotAfter) > this.nowMs()
    );
  });

  /** The requester can withdraw a pending request, or an approved one whose window has not lapsed. */
  protected readonly canCancel = computed(() => {
    const request = this.request();
    if (request == null || !this.isRequester()) {
      return false;
    }
    if (request.status === "pending") {
      return true;
    }
    return (
      request.status === "approved" &&
      request.producedLeaseId == null &&
      Date.parse(request.leaseNotAfter) > this.nowMs()
    );
  });

  /** The holder can end their own active lease early. */
  protected readonly canEndLease = computed(() => this.isRequester() && this.leaseActive());

  /** An approver can decide a request still waiting in their inbox. */
  protected readonly canDecide = computed(() => this.isApprover() && this.approvalRow() != null);

  /** An approver can withdraw an approval the requester has not started — as the History tab does. */
  protected readonly canWithdrawApproval = computed(() => {
    const request = this.request();
    return (
      request != null &&
      this.isApprover() &&
      this.managed() &&
      request.status === "approved" &&
      request.producedLeaseId == null
    );
  });

  /**
   * An approver can end access someone is using right now on a collection they manage. No window
   * check: an extension runs the lease past the request's `leaseNotAfter`, as History allows for.
   */
  protected readonly canRevoke = computed(() => {
    const request = this.request();
    return request != null && this.isApprover() && this.managed() && isLiveManagedLease(request);
  });

  ngOnInit(): void {
    // Kept outside the Angular zone so a periodic in-zone timer never blocks `whenStable()`; the
    // signal write still drives change detection.
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => this.nowMs.set(Date.now()), 1000);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    });

    // A non-404 load failure (404 is the not-found state) surfaces as a toast.
    this.detail.loadError$
      .pipe(
        filter((e) => e != null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamAccessRequestLoadError"),
        });
      });
  }

  protected cipherFor(cipherIdValue: AccessRequestView["cipherId"]): CipherView | undefined {
    return this.cipherById().get(uuidAsString(cipherIdValue));
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
        message: this.i18nService.t("pamMyRequestsCanceledToast"),
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
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(activateAccessErrorMessageKey(e)),
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

  /**
   * Confirm and record a decision through the same dialog the Approvals inbox uses. Records the
   * verdict the dialog closed with, since its approve variant can switch to deny in place.
   */
  protected async decide(verdict: AccessDecisionVerdict): Promise<void> {
    const row = this.approvalRow();
    if (row == null || !this.canDecide() || this.deciding()) {
      return;
    }
    const result = await firstValueFrom(
      DecideDialogComponent.open(this.dialogService, {
        data: { verdict, row, cipher: this.cipherFor(row.request.cipherId) },
      }).closed,
    );
    if (!result?.confirmed) {
      return;
    }
    this.deciding.set(true);
    try {
      await this.detail.decide(result.verdict, result.comment);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          result.verdict === "approve" ? "pamInboxApprovedToast" : "pamInboxDeniedToast",
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

  /** Withdraw an unstarted approval, confirmed first since the requester loses it outright. */
  protected async withdrawApproval(): Promise<void> {
    if (!this.canWithdrawApproval() || this.withdrawing()) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamInboxWithdrawApproval" },
      content: { key: "pamInboxWithdrawApprovalConfirm", placeholders: [this.cipherName() ?? ""] },
      acceptButtonText: { key: "pamInboxWithdrawApproval" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    this.withdrawing.set(true);
    try {
      await this.detail.withdrawApproval();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamInboxApprovalWithdrawnToast"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxWithdrawApprovalFailed"),
      });
    } finally {
      this.withdrawing.set(false);
    }
  }

  /** End someone else's running access, confirmed first since it cuts off access in use. */
  protected async revoke(): Promise<void> {
    const leaseId = this.request()?.producedLeaseId;
    if (leaseId == null || !this.canRevoke() || this.revoking()) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamInboxRevoke" },
      content: { key: "pamInboxRevokeConfirm" },
      acceptButtonText: { key: "pamInboxRevoke" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    this.revoking.set(true);
    try {
      await this.detail.revokeLease(leaseId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamInboxRevokedToast"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxRevokeFailed"),
      });
    } finally {
      this.revoking.set(false);
    }
  }

  /**
   * `closeOnNavigation` is off; the host route decides when this closes, not the router. A CDK
   * close on back-navigation would send the browser back twice.
   */
  static open(
    dialogService: DialogService,
    params: AccessRequestDialogParams,
  ): DialogRef<void, AccessRequestDialogComponent> {
    return dialogService.open<void, AccessRequestDialogParams, AccessRequestDialogComponent>(
      AccessRequestDialogComponent,
      { data: params, closeOnNavigation: false },
    );
  }
}

/** The gated cipher's raw (string) id — the key {@link ResolvedNames} maps are keyed on. */
function cipherId(request: AccessRequestView): string {
  return uuidAsString(request.cipherId);
}

/** The gated collection's raw (string) id — the key {@link ResolvedNames} maps are keyed on. */
function collectionId(request: AccessRequestView): string {
  return uuidAsString(request.collectionId);
}
