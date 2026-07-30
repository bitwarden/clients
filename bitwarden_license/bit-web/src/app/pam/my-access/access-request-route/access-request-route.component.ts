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
import { filter } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
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
  AccessRequestView,
  durationLabel,
  exactWindow,
  formatRemaining,
  reasonText,
  relativeStart,
} from "../..";
import { emptyResolvedNames } from "../access-name-resolver.service";
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

/**
 * The dedicated, shareable page for one of the caller's own access requests
 * (`/pam/requests/:id`). Reached by clicking a request/lease row in "My access", or a direct link.
 *
 * Trimmed port of the `pam/poc` branch's `access-request-route.component`: the pass-1
 * `AccessRequestSdkService.getAccessRequest` is user-scoped (it only ever returns one of the
 * caller's own requests), so — unlike the poc, which could be opened by any approver — every
 * request this page loads belongs to the viewer. That drops the poc's approver plumbing entirely:
 * no `canApprove$`/`currentUserId$`/`isRequester`, and no Approve/Deny + `DecideDialog` (a
 * requester never decides their own request — that's the deferred approver-inbox flow). Only
 * Start / Cancel / End access are offered here.
 *
 * Data, name resolution, and mutations live in the page-scoped {@link AccessRequestDetailService};
 * this component owns only the view (the live countdown clock and the action affordances).
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

  /** Ticks once a second so the lease / redemption countdowns stay live. */
  private readonly nowMs = signal(Date.now());

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

  /** The recorded decisions as a view model, oldest first (as the server returns them). */
  protected readonly decisions = computed(() => {
    const request = this.request();
    if (request == null) {
      return [];
    }
    return request.decisions.map((decision) => {
      const denied = decision.verdict === "deny";
      // A Deny recorded against a request that did not end Denied is the lease ending, not a
      // denial: the revoke / self-end path stores its reason as a Deny decision.
      const leaseEnd = denied && request.status !== "denied";
      const outcome = !denied
        ? "approved"
        : !leaseEnd
          ? "denied"
          : decision.id === request.requesterId
            ? "endedByHolder"
            : "revoked";
      return {
        automatic: decision.deciderKind === "automatic",
        who:
          decision.name || decision.email || (decision.id == null ? "" : uuidAsString(decision.id)),
        outcome,
        labelKey: DECISION_LABEL_KEYS[outcome],
        comment: decision.comment,
        decidedAt: decision.decidedAt,
      };
    });
  });

  protected readonly leaseActive = computed(() => this.request()?.producedLeaseStatus === "active");

  /** A live "ends in X" label while the produced lease is active and its window is still open. */
  protected readonly leaseRemaining = computed(() => {
    const request = this.request();
    if (request == null || !this.leaseActive()) {
      return null;
    }
    const remaining = Date.parse(request.leaseNotAfter) - this.nowMs();
    return remaining > 0 ? formatRemaining(remaining) : null;
  });

  /** A live "activate within X" label for an approved on-demand request. */
  protected readonly redemptionRemaining = computed(() => {
    const request = this.request();
    if (request == null || request.status !== "approved") {
      return null;
    }
    // actionable_until: today the window end is the only actionable bound the server enforces.
    return formatRemaining(Date.parse(request.leaseNotAfter) - this.nowMs());
  });

  /** The requester can start an approved request while its window can still produce access. */
  protected readonly canStart = computed(() => {
    const request = this.request();
    return (
      request != null &&
      request.status === "approved" &&
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
    return request.status === "approved" && Date.parse(request.leaseNotAfter) > this.nowMs();
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

  protected cipherFor(cipherIdValue: string): CipherView | undefined {
    return this.cipherById().get(cipherIdValue);
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

/** The gated cipher's raw (string) id — the key {@link ResolvedNames} maps are keyed on. */
function cipherId(request: AccessRequestView): string {
  return uuidAsString(request.cipherId);
}

/** The gated collection's raw (string) id — the key {@link ResolvedNames} maps are keyed on. */
function collectionId(request: AccessRequestView): string {
  return uuidAsString(request.collectionId);
}
