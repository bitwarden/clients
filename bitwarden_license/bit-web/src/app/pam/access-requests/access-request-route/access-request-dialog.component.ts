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
import { filter } from "rxjs";

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
import { AccessStateBadgeComponent } from "../../access-state-badge/access-state-badge.component";
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
   * Handed in rather than injected, because it is scoped to the `/pam/requests/:id` route that
   * opened this dialog: `DialogService` builds the dialog's injector from its own, which is the
   * root one, so a route-scoped provider is not reachable from inside here.
   */
  detail: AccessRequestDetailService;
};

/**
 * One of the caller's own access requests, opened over the access-requests shell by the
 * `/pam/requests/:id` route. Reached by clicking a request/lease row in "My access", or a direct
 * link; the host route owns the URL and the close navigation, this dialog owns the view.
 *
 * Trimmed port of the `pam/poc` branch's `access-request-route.component`: the pass-1
 * `AccessRequestSdkService.getAccessRequest` is user-scoped (it only ever returns one of the
 * caller's own requests), so — unlike the poc, which could be opened by any approver — every
 * request this loads belongs to the viewer. That drops the poc's approver plumbing entirely:
 * no `canApprove$`/`currentUserId$`/`isRequester`, and no Approve/Deny + `DecideDialog` (a
 * requester never decides their own request — that's the deferred approver-inbox flow). Only
 * Start / Cancel / End access are offered here.
 *
 * Data, name resolution, and mutations live in {@link AccessRequestDetailService}; this component
 * owns only the view (the live countdown clock and the action affordances).
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

  /** Cipher name resolved from local vault state; falls back to the raw id. */
  protected readonly cipherName = computed(() => {
    const request = this.request();
    return request == null
      ? null
      : (this.names().cipherNameById.get(cipherId(request)) ?? cipherId(request));
  });

  /** Collection name resolved from local vault state; null when unknown. */
  protected readonly collectionName = computed(() => {
    const request = this.request();
    return request == null
      ? null
      : (this.names().collectionNameById.get(collectionId(request)) ?? null);
  });

  /** Owning organization's name resolved from the caller's membership; null when unknown. */
  protected readonly organizationName = computed(() => {
    const request = this.request();
    return request == null ? null : organizationNameFor(request, this.names());
  });

  /** Ticks once a second so the lease / redemption countdowns stay live. */
  protected readonly nowMs = signal(Date.now());

  /** Per-action in-flight flags (prevent double-submit and drive button spinners). */
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
      // A Deny recorded against a request that did not end Denied is the lease ending, not a
      // denial: the revoke / self-end path stores its reason as a Deny decision.
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
      request.status === "approved" &&
      request.producedLeaseId == null &&
      Date.parse(request.leaseNotAfter) > this.nowMs()
    );
  });

  /** The requester can withdraw a pending request, or an approved one whose window has not lapsed. */
  protected readonly canCancel = computed(() => {
    const request = this.request();
    if (request == null) {
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
  protected readonly canEndLease = computed(() => this.leaseActive());

  ngOnInit(): void {
    // Keep the countdown clock outside the Angular zone so a periodic in-zone timer never blocks
    // `whenStable()` for tests/hosts; the signal write still drives change detection.
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
   * `closeOnNavigation` is off because the host route, not the router, decides when this closes: a
   * CDK close on the back-button navigation would run the host's close handler and send the
   * browser back a second time.
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
