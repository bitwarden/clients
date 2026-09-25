import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  from,
  map,
  merge,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import {
  type AccessBadgeState,
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  type AccessRequestView,
  type CipherAccessStateView,
  ENDING_SOON_THRESHOLD_MS,
  activateAccessErrorMessageKey,
  isGovernedCipher,
  liveActiveLease,
  requestedWindowSeconds,
} from "@bitwarden/bit-common/pam";
import { DurationLongPipe } from "@bitwarden/bit-common/pam/date/duration-long.pipe";
import { isUnlicensedError } from "@bitwarden/bit-common/pam/helpers/pam-license-error";
import {
  callerOrganizations$,
  unlicensedForPam,
} from "@bitwarden/bit-common/pam/services/pam-membership";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  DialogService,
  IconModule,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { RequestAccessDialogComponent } from "../request-access-dialog/request-access-dialog.component";

import { ExtendLeaseDialogComponent } from "./extend-lease-dialog.component";

/**
 * Requester's PAM flow on a gated item in the popup: request, pending, start, extend, end. The
 * licensing block replaces every other state, since the server withholds a gated cipher from an
 * unlicensed caller regardless of lease.
 */
@Component({
  selector: "app-pam-cipher-view-banner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./cipher-view-banner.component.html",
  imports: [
    AccessStateBadgeComponent,
    AsyncActionsModule,
    ButtonModule,
    CardComponent,
    IconModule,
    SectionHeaderComponent,
    TypographyModule,
    DatePipe,
    DurationLongPipe,
    I18nPipe,
  ],
})
export class CipherViewBannerComponent implements OnInit {
  /** The cipher the view is showing, partial when the server gated it. */
  readonly cipher = input.required<CipherView>();

  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessLeaseSdkService = inject(AccessLeaseSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  /** Ticks every second so the live countdown and a scheduled window's opening stay current. */
  private readonly nowMs = signal(Date.now());

  private readonly enabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);

  private readonly organizations$ = callerOrganizations$(
    this.accountService,
    this.organizationService,
  );

  /** The open cipher when PAM governs it, `null` otherwise; gates {@link state} and {@link unlicensed}. */
  private readonly governedCipher$ = combineLatest([toObservable(this.cipher), this.enabled$]).pipe(
    map(([cipher, enabled]) =>
      !enabled || cipher.id == null || !isGovernedCipher(cipher) ? null : cipher,
    ),
    distinctUntilChanged(),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /** The caller's access state for the open cipher, re-read on every {@link AccessRefreshService} change. */
  protected readonly state = toSignal(
    this.governedCipher$.pipe(
      switchMap((cipher) => {
        if (cipher == null) {
          return of(null);
        }
        const cipherId = String(cipher.id);
        return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
          switchMap(() =>
            from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
              catchError((e: unknown) => {
                // A gated cipher whose state can't be read renders no banner, not an error, matching
                // the name-row badge.
                this.logService.error(e);
                return of(null);
              }),
            ),
          ),
        );
      }),
    ),
    { initialValue: null },
  );

  /**
   * Whether the caller is blocked from privileged access by their own licensing — see
   * {@link unlicensedForPam}. Read from local membership state, independent of {@link state} so the
   * block still renders when that read fails.
   */
  protected readonly unlicensed = toSignal(
    this.governedCipher$.pipe(
      map((cipher) => cipher?.organizationId ?? null),
      distinctUntilChanged(),
      switchMap((organizationId) =>
        organizationId == null
          ? of(false)
          : this.organizations$.pipe(
              map((organizations) =>
                unlicensedForPam(organizations.find((o) => o.id === organizationId)),
              ),
            ),
      ),
    ),
    // Tri-state: `undefined` until membership loads; callers compare with `=== false`.
    { initialValue: undefined },
  );

  protected readonly activeLease = computed(() => liveActiveLease(this.state(), this.nowMs()));
  protected readonly pendingRequest = computed(() => this.state()?.pendingRequest);

  protected readonly approvedRequest = computed(() => unactivatedApprovedRequest(this.state()));

  /**
   * How much access the approval granted, from the request's own activation window — the length of
   * the grant, not the time left to use it, since the lease still ends at `leaseNotAfter`.
   *
   * `null` for a window that does not resolve to a positive span.
   */
  protected readonly approvedDurationSeconds = computed(() => {
    const approved = this.approvedRequest();
    if (approved == null) {
      return null;
    }
    const seconds = requestedWindowSeconds(approved);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  });

  /** The rule governing the active lease opted into extensions. */
  protected readonly canExtendLease = computed(() => this.state()?.extensionsAllowed === true);

  /**
   * Offer "Request access" only for a still-gated cipher with nothing already in play, held by
   * someone licensed to ask. A cipher that is `leaseGated` but has no active lease has just lapsed;
   * its state stream re-drives the resting banner instead.
   */
  protected readonly canRequestAccess = computed(
    () =>
      this.state() != null &&
      this.cipher().partial &&
      this.unlicensed() === false &&
      this.activeLease() == null &&
      this.approvedRequest() == null &&
      this.pendingRequest() == null,
  );

  /** Whether any state renders, so the section header never stands alone. */
  protected readonly hasContent = computed(
    () =>
      this.unlicensed() === true ||
      this.activeLease() != null ||
      this.approvedRequest() != null ||
      this.pendingRequest() != null ||
      this.canRequestAccess(),
  );

  /**
   * The governing rule's terms for a request not yet made, read through `preCheck` —
   * {@link state} carries no such fields. `null` when the cap is missing, not a made-up limit.
   */
  protected readonly restingRequestTerms = toSignal(
    toObservable(computed(() => (this.canRequestAccess() ? this.cipher().id : null))).pipe(
      switchMap((cipherId) =>
        cipherId == null
          ? of(null)
          : from(this.accessRequestSdkService.preCheck(String(cipherId))).pipe(
              map(({ approvalMode, maxDurationSeconds }) =>
                Number.isFinite(maxDurationSeconds)
                  ? {
                      maxSeconds: maxDurationSeconds,
                      messageKey:
                        approvalMode === "automatic"
                          ? "pamRequestAccessBannerMaxDurationAutomatic"
                          : "pamRequestAccessBannerMaxDuration",
                    }
                  : null,
              ),
              catchError((e: unknown) => {
                this.logService.error(e);
                return of(null);
              }),
            ),
      ),
    ),
    { initialValue: null },
  );

  // Parsed once per lease change, not per tick.
  private readonly activeLeaseExpiryMs = computed(() => {
    const lease = this.activeLease();
    return lease == null ? 0 : Date.parse(lease.notAfter);
  });

  protected readonly activeBadge = computed<AccessBadgeState | null>(() =>
    this.activeLease() == null
      ? null
      : { kind: "active", expiresAt: new Date(this.activeLeaseExpiryMs()) },
  );

  /** Whether the active lease is within {@link ENDING_SOON_THRESHOLD_MS} of its end. */
  protected readonly leaseEndingSoon = computed(
    () =>
      this.activeLease() != null &&
      this.activeLeaseExpiryMs() - this.nowMs() <= ENDING_SOON_THRESHOLD_MS,
  );

  protected readonly approvedRequestStartsNow = computed(() => {
    const request = this.approvedRequest();
    return request != null && Date.parse(request.leaseNotBefore) <= this.nowMs();
  });

  /**
   * Whether anything on screen still reads {@link nowMs} — only the active lease's countdown and an
   * approved request awaiting its window.
   */
  private readonly clockAdvances = computed(
    () =>
      this.activeLease() != null ||
      (this.approvedRequest() != null && !this.approvedRequestStartsNow()),
  );

  ngOnInit(): void {
    // Kept outside the Angular zone: an in-zone periodic timer never lets NgZone settle, which
    // would hang `fixture.whenStable()`. The signal write still drives change detection.
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => {
        if (this.clockAdvances()) {
          this.nowMs.set(Date.now());
        }
      }, 1000);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    });
  }

  /** Opens {@link RequestAccessDialogComponent}, which announces its own change on success. */
  protected openRequestDialog(): void {
    const cipher = this.cipher();
    if (cipher.id == null) {
      return;
    }
    RequestAccessDialogComponent.open(this.dialogService, {
      cipherId: String(cipher.id),
      itemName: cipher.name,
    });
  }

  protected readonly activateRequest = async (): Promise<void> => {
    const approved = this.approvedRequest();
    if (approved == null) {
      return;
    }
    try {
      await this.accessRequestSdkService.activateAccessRequest(approved.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      // A taken single-active-access slot surfaces here; the approved request stays activatable.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(activateAccessErrorMessageKey(e)),
      });
    } finally {
      this.notifyAccessChanged();
    }
  };

  /**
   * Withdraw the outstanding request, pending or approved-but-unstarted. Re-reads the state at
   * click time, since the request may have been decided or activated since render.
   */
  protected readonly cancelRequest = async (): Promise<void> => {
    const cipherId = this.cipher().id;
    if (cipherId == null) {
      return;
    }
    try {
      const state = await this.accessRequestSdkService.getCipherAccessState(String(cipherId));
      const request = state.pendingRequest ?? unactivatedApprovedRequest(state);
      if (request == null) {
        return;
      }
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamCancelRequestTitle" },
        content: {
          key:
            state.pendingRequest != null
              ? "pamCancelRequestPendingConfirm"
              : "pamCancelRequestApprovedConfirm",
        },
        acceptButtonText: { key: "pendingStateCancelRequest" },
        cancelButtonText: { key: "pamKeepRequest" },
        type: "danger",
      });
      if (!confirmed) {
        return;
      }
      await this.accessRequestSdkService.cancelAccessRequest(request.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamCancelRequestCanceledToast"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pendingStateCancelError"),
      });
    } finally {
      this.notifyAccessChanged();
    }
  };

  /**
   * Extends the active lease through {@link ExtendLeaseDialogComponent}.
   *
   * A resolved-but-denied extension is not a thrown error: branch on the returned status, not
   * try/catch, or an expired-lease denial reads as a successful extension.
   */
  protected readonly extendLease = async (): Promise<void> => {
    const lease = this.activeLease();
    if (lease == null) {
      return;
    }
    const request = await firstValueFrom(
      ExtendLeaseDialogComponent.open(this.dialogService).closed,
    );
    if (request == null) {
      return;
    }
    try {
      const extension = await this.accessLeaseSdkService.extendLease(lease.id, request);
      const denied = extension.status === "denied";
      this.toastService.showToast({
        variant: denied ? "warning" : "success",
        message: this.i18nService.t(denied ? "pamExtendLeaseEnded" : "pamExtendLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        // Reachable only if the seat is withdrawn between render and click; `canExtendLease`
        // normally hides this button.
        message: this.i18nService.t(
          isUnlicensedError(e) ? "pamLeaseErrorUnlicensed" : "pamExtendLeaseError",
        ),
      });
    } finally {
      this.notifyAccessChanged();
    }
  };

  protected readonly endLease = async (): Promise<void> => {
    const lease = this.activeLease();
    if (lease == null) {
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
    try {
      await this.accessLeaseSdkService.endLease(lease.id, { reason: undefined });
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
      this.notifyAccessChanged();
    }
  };

  /**
   * Announce that this cipher's access changed, which re-reads the state here and lets the
   * name-row badge above settle onto the same answer.
   */
  private notifyAccessChanged(): void {
    const cipherId = this.cipher().id;
    if (cipherId != null) {
      this.accessRefreshService.notifyAccessChanged(String(cipherId));
    }
  }
}

/**
 * The approved request still awaiting Start. An activated request stays `approved` and carries
 * `producedLeaseId`, so activation is never read from the status.
 */
function unactivatedApprovedRequest(
  state: CipherAccessStateView | null | undefined,
): AccessRequestView | undefined {
  const approved = state?.approvedRequest;
  return approved?.producedLeaseId == null ? approved : undefined;
}
