import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  NgZone,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { filter } from "rxjs";

import { NoResults } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeComponent,
  ButtonModule,
  CalloutModule,
  CardComponent,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  StatusLockupComponent,
  SvgComponent,
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
import type { AccessBadgeState } from "../../access-state-badge/access-badge-state";
import { AccessStateBadgeComponent } from "../../access-state-badge/access-state-badge.component";
import { ApproverActionsService } from "../../approvals/approver-actions.service";
import { isLiveManagedLease, isUnstartedApproval } from "../../approvals/managed-lease-row";
import { DurationShortPipe } from "../../date/duration-short.pipe";
import { RemainingTimePipe } from "../../date/remaining-time.pipe";
import { RequestSummaryComponent } from "../../request-summary/request-summary.component";
import { SummaryFieldComponent } from "../../request-summary/summary-field.component";
import { emptyResolvedNames, organizationNameFor } from "../access-name-resolver.service";
import { TerminalStatusBadge, historyDisplayStatus, lapsedGrantBadge } from "../my-access-row";

import { AccessRequestDetailService } from "./access-request-detail.service";

/** What the item card badges with: the shared access pill, or a plain terminal-status chip. */
type DialogBadge = {
  readonly badgeState: AccessBadgeState | null;
  readonly statusBadge: TerminalStatusBadge | null;
};

/**
 * Shared instances, since `badge` recomputes on the clock and a fresh object each tick would
 * restart the pill's own countdown.
 */
const READY_BADGE: DialogBadge = { badgeState: { kind: "ready" }, statusBadge: null };
const LAPSED_BADGE: DialogBadge = { badgeState: null, statusBadge: lapsedGrantBadge };

export type AccessRequestDialogParams = {
  /**
   * Handed in rather than injected, since `DialogService` builds the dialog's injector from the
   * root one, out of reach of route-scoped providers.
   */
  detail: AccessRequestDetailService;
};

/**
 * The view for `/pam/requests/:id`; the host route owns the URL and close navigation. The same
 * link reaches the requester and approvers, so the footer offers only the viewer's own actions.
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
    CalloutModule,
    CardComponent,
    DialogModule,
    FormFieldModule,
    ReactiveFormsModule,
    RouterModule,
    StatusLockupComponent,
    SvgComponent,
    TypographyModule,
    DurationShortPipe,
    RemainingTimePipe,
    RequestSummaryComponent,
    SummaryFieldComponent,
  ],
  providers: [ApproverActionsService],
})
export class AccessRequestDialogComponent implements OnInit {
  protected readonly noResultsSvg = NoResults;

  private readonly detail = inject<AccessRequestDialogParams>(DIALOG_DATA).detail;
  private readonly dialogService = inject(DialogService);
  private readonly approverActions = inject(ApproverActionsService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly locale = inject(LOCALE_ID);

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
  /** An approver looking at a decided request on a collection they manage. */
  private readonly approverManages = computed(() => this.isApprover() && this.managed());

  protected readonly cipherName = computed(() => {
    const request = this.request();
    return request == null
      ? null
      : (this.names().cipherNameById.get(cipherId(request)) ?? cipherId(request));
  });

  protected readonly collectionName = computed(() => {
    const request = this.request();
    return request == null
      ? null
      : (this.names().collectionNameById.get(collectionId(request)) ?? null);
  });

  protected readonly organizationName = computed(() => {
    const request = this.request();
    return request == null ? null : organizationNameFor(request, this.names());
  });

  /** Ticks every second so the countdowns stay live. */
  protected readonly nowMs = signal(Date.now());

  /** Per-action in-flight flags (prevent double-submit and drive button spinners). */
  protected readonly cancelling = signal(false);
  protected readonly starting = signal(false);
  protected readonly ending = signal(false);
  protected readonly deciding = signal(false);
  protected readonly withdrawing = signal(false);
  protected readonly revoking = signal(false);

  /** The activation deadline as a number, parsed once per request rather than per reader. */
  private readonly leaseNotAfterMs = computed(() => {
    const request = this.request();
    return request == null ? null : Date.parse(request.leaseNotAfter);
  });

  protected readonly badge = computed(() => {
    const request = this.request();
    if (request == null) {
      return null;
    }
    // A running lease badges as its own countdown, which escalates to "ending soon" on the
    // threshold the pill owns — so the dialog never has to name either state itself.
    const endsAt = this.leaseEndsAt();
    if (endsAt != null) {
      return {
        badgeState: { kind: "active", expiresAt: new Date(endsAt) } as const,
        statusBadge: null,
      };
    }
    if (isUnstartedApproval(request)) {
      // An approval still inside its window badges "Ready to use" on both sides of the dialog.
      // The tables keep saying "Approved" to an approver, who has nothing to use themselves.
      return (this.leaseNotAfterMs() ?? 0) <= this.nowMs() ? LAPSED_BADGE : READY_BADGE;
    }
    return historyDisplayStatus(request);
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
    return request == null ? "" : exactWindow(request, this.locale);
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

  /**
   * The decision that resolved the request, as the "Decision" card reads it: who decided, how to
   * reach them, and any note they left. The full log stays in the audit trail; this names only the
   * outcome the viewer is looking at. Null until something has been decided.
   */
  protected readonly decisionSummary = computed(() => {
    const request = this.request();
    if (request == null) {
      return null;
    }
    // The resolving decision is the last the server recorded; earlier ones are superseded.
    const decision = request.decisions.at(-1);
    if (decision == null) {
      return null;
    }
    const approver = humanApprover(decision);
    const named = approver?.name || approver?.email || null;
    return {
      byLabelKey: request.status === "denied" ? "pamDecisionDeniedBy" : "pamDecisionApprovedBy",
      who:
        decision.decider === "automatic"
          ? this.i18nService.t("pamDecisionAutomatic")
          : (named ?? this.i18nService.t("pamResolverUnknown")),
      // Only worth a row of its own when it isn't already standing in as the name.
      email: approver?.email && approver.email !== approver.name ? approver.email : null,
      comment: decision.comment,
    };
  });

  /**
   * The withdraw confirmation is a second face of this dialog rather than a separate one, so the
   * item it concerns stays on screen while the approver writes the note.
   */
  protected readonly confirmingWithdraw = signal(false);

  protected readonly withdrawReason = new FormControl("", { nonNullable: true });

  private readonly withdrawReasonText = toSignal(this.withdrawReason.valueChanges, {
    initialValue: "",
  });

  /** The server rejects a managing approver's withdrawal without a note, so the action waits. */
  protected readonly withdrawReasonGiven = computed(
    () => this.withdrawReasonText().trim().length > 0,
  );

  protected readonly leaseActive = computed(() => this.request()?.producedLeaseStatus === "active");

  /**
   * The applied extension's added time and new end; null if never extended. A lease extends at
   * most once, so the whole delta is that extension's.
   */
  protected readonly extension = computed(() => {
    const request = this.request();
    if (request?.producedLeaseNotAfter == null) {
      return null;
    }
    const addedMs = Date.parse(request.producedLeaseNotAfter) - Date.parse(request.leaseNotAfter);
    return addedMs <= 0
      ? null
      : { addedSeconds: addedMs / 1000, until: request.producedLeaseNotAfter };
  });

  /**
   * The countdown target while the lease is live. Reads `producedLeaseNotAfter` because an
   * extension never restamps `leaseNotAfter`, falling back to the latter for servers that omit the
   * field.
   */
  protected readonly leaseEndsAt = computed(() => {
    const request = this.request();
    if (request == null || !this.leaseActive()) {
      return null;
    }
    const endsAt = request.producedLeaseNotAfter ?? request.leaseNotAfter;
    return Date.parse(endsAt) > this.nowMs() ? endsAt : null;
  });

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

  /**
   * Only while the request is still undecided. Once approved it offers Start instead — the
   * requester withdraws an approval they no longer want from the My requests table.
   */
  protected readonly canCancel = computed(
    () => this.isRequester() && this.request()?.status === "pending",
  );

  /**
   * A request that was refused or timed out is re-asked rather than revived, so the requester is
   * sent to the item to raise a fresh one with the old request still on screen behind them.
   */
  protected readonly canResubmit = computed(() => {
    const status = this.request()?.status;
    return this.isRequester() && (status === "denied" || status === "expired");
  });

  /** The item this request was for, as the vault's own deep link opens it. */
  protected readonly resubmitLink = computed(() => {
    const request = this.request();
    return request == null ? null : ["/vault"];
  });

  protected readonly resubmitParams = computed(() => {
    const request = this.request();
    return request == null ? null : { itemId: cipherId(request), action: "view" };
  });

  protected readonly canEndLease = computed(() => this.isRequester() && this.leaseActive());

  protected readonly canDecide = computed(() => this.isApprover() && this.approvalRow() != null);

  protected readonly canWithdrawApproval = computed(() => {
    const request = this.request();
    return request != null && this.approverManages() && isUnstartedApproval(request);
  });

  /** No window check, since an extension runs the lease past the request's `leaseNotAfter`. */
  protected readonly canRevoke = computed(() => {
    const request = this.request();
    return request != null && this.approverManages() && isLiveManagedLease(request);
  });

  ngOnInit(): void {
    // Kept outside the Angular zone so a periodic in-zone timer never blocks `whenStable()`; the
    // signal write still drives change detection.
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => this.nowMs.set(Date.now()), 1000);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    });

    // A 404 is the not-found state; any other load failure toasts.
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

  /** Decide through the same dialog, toasts and failure handling as the Approvals inbox. */
  protected async decide(verdict: AccessDecisionVerdict): Promise<void> {
    const row = this.approvalRow();
    if (row == null || !this.canDecide() || this.deciding()) {
      return;
    }
    await this.approverActions.decide(
      { verdict, row, cipher: this.cipherFor(row.request.cipherId) },
      (decided, comment) => this.detail.decide(decided, comment),
      (busy) => this.deciding.set(busy),
    );
  }

  /** Turns the dialog over to its confirmation face; the withdrawal itself waits for a reason. */
  protected withdrawApproval(): void {
    if (!this.canWithdrawApproval() || this.withdrawing()) {
      return;
    }
    this.withdrawReason.setValue("");
    this.confirmingWithdraw.set(true);
  }

  /** Returns to the request, keeping the note so re-opening the confirmation does not lose it. */
  protected cancelWithdraw(): void {
    this.confirmingWithdraw.set(false);
  }

  protected async confirmWithdraw(): Promise<void> {
    if (!this.withdrawReasonGiven() || this.withdrawing()) {
      return;
    }
    const reason = this.withdrawReason.value.trim();
    await this.approverActions.withdrawApproval(
      () => this.detail.withdrawApproval(reason),
      (busy) => this.withdrawing.set(busy),
    );
    this.confirmingWithdraw.set(false);
  }

  protected async revoke(): Promise<void> {
    const leaseId = this.request()?.producedLeaseId;
    if (leaseId == null || !this.canRevoke() || this.revoking()) {
      return;
    }
    await this.approverActions.revoke(
      () => this.detail.revokeLease(leaseId),
      (busy) => this.revoking.set(busy),
    );
  }

  /**
   * `closeOnNavigation` is off because the host route decides when this closes; a CDK close on
   * back-navigation would send the browser back twice.
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

function cipherId(request: AccessRequestView): string {
  return uuidAsString(request.cipherId);
}

function collectionId(request: AccessRequestView): string {
  return uuidAsString(request.collectionId);
}
