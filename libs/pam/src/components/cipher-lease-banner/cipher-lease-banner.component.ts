import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CipherAccessState, PamApiService } from "../../abstractions/pam-api.service";
import { RequestAccessTrigger } from "../../abstractions/request-access-trigger";
import { formatRemaining } from "../../helpers/format-remaining";
import { LeaseExtensionRequest } from "../../services/requests/lease-extension.request";
import { LeaseRevokeRequest } from "../../services/requests/lease-revoke.request";

@Component({
  selector: "app-cipher-lease-banner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "cipher-lease-banner.component.html",
  imports: [AsyncActionsModule, ButtonModule, I18nPipe],
})
export class CipherLeaseBannerComponent implements OnInit {
  readonly cipherId = input.required<string>();
  /**
   * Server-supplied partial-data blob attached to leasing-gated ciphers on
   * sync. Presence is the gating signal: when set, the cipher requires a lease
   * and the "Request access" entry point should render whenever no lease /
   * approved ticket / pending request exists.
   */
  readonly partialData = input<string | undefined>(undefined);

  private readonly destroyRef = inject(DestroyRef);
  private readonly nowMs = signal(Date.now());
  private readonly pamApiService = inject(PamApiService);
  private readonly toastService = inject(ToastService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly accountService = inject(AccountService);
  private readonly configService = inject(ConfigService);
  private readonly requestAccessTrigger = inject(RequestAccessTrigger, { optional: true });
  private readonly pamEnabled = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });

  protected readonly state = toSignal(
    combineLatest([
      toObservable(this.cipherId),
      getUserId(this.accountService.activeAccount$),
    ]).pipe(
      switchMap(([cipherId, userId]) => this.pamApiService.getCipherAccessState$(cipherId, userId)),
    ),
    { initialValue: { lease: {} } as CipherAccessState },
  );

  protected readonly activeLease = computed(() => this.state().lease.activeLease);
  protected readonly pendingRequest = computed(() => this.state().lease.pendingRequest);
  protected readonly approvedTicket = computed(() => this.state().lease.approvedTicket);

  /**
   * Show the "Request access" entry point when:
   * - the PAM feature flag is on,
   * - a {@link RequestAccessTrigger} impl is provided by the host,
   * - the cipher is gated (has `partialData`),
   * - and there's no active lease / approved ticket / pending request yet.
   */
  protected readonly canRequestAccess = computed(
    () =>
      this.pamEnabled() &&
      this.requestAccessTrigger != null &&
      this.partialData() != null &&
      !this.activeLease() &&
      !this.approvedTicket() &&
      !this.pendingRequest(),
  );

  // Parse the ISO `notAfter` once per lease change; without caching the per-second
  // `nowMs()` tick would re-parse the same string 60×/min.
  private readonly activeLeaseExpiryMs = computed(() => {
    const lease = this.activeLease();
    return lease ? Date.parse(lease.notAfter) : 0;
  });

  readonly leaseRemainingLabel = computed(() => {
    if (!this.activeLease()) {
      return "";
    }
    return formatRemaining(this.activeLeaseExpiryMs() - this.nowMs());
  });

  ngOnInit(): void {
    const intervalId = setInterval(() => this.nowMs.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  readonly startLease = async () => {
    const ticket = this.approvedTicket();
    if (!ticket) {
      return;
    }
    try {
      await this.pamApiService.startLease(ticket.id);
      // `getCipherAccessState$` re-emits on the Activated event; the active-lease
      // branch takes over once the new lease lands.
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        // A taken single-active-lease slot or an org-wide freeze surfaces here;
        // the ticket stays redeemable for a manual retry.
        message: this.i18nService.t("pamStartLeaseError"),
      });
    }
  };

  readonly cancelAccessRequest = async () => {
    const request = this.pendingRequest();
    if (!request) {
      return;
    }
    try {
      await this.pamApiService.cancelAccessRequest(request.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pendingStateCancelSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pendingStateCancelError"),
      });
    }
  };

  readonly endLease = async () => {
    const lease = this.activeLease();
    if (!lease) {
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
      await this.pamApiService.revokeLease(lease.id, new LeaseRevokeRequest({}));
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
    }
  };

  readonly requestAccess = async () => {
    const trigger = this.requestAccessTrigger;
    if (!trigger) {
      return;
    }
    try {
      await trigger.requestAccess(this.cipherId());
      // The trigger surfaces its own success/error toasts. State observed via
      // getCipherAccessState$ re-emits when a new lease/request lands.
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  };

  readonly extendLease = async () => {
    const lease = this.activeLease();
    if (!lease) {
      return;
    }
    const currentNotAfter = new Date(lease.notAfter);
    const newNotAfter = new Date(currentNotAfter.getTime() + 60 * 60 * 1000);
    try {
      const response = await this.pamApiService.requestLeaseExtension(
        new LeaseExtensionRequest({
          leaseId: lease.id,
          notBefore: currentNotAfter,
          notAfter: newNotAfter,
        }),
      );
      // `getCipherAccessState$` is the source of truth for the eventual outcome;
      // surface a status-appropriate toast and let the next stream emission
      // update the visible countdown.
      const approved = response.status === "approved";
      this.toastService.showToast({
        variant: approved ? "success" : "info",
        message: this.i18nService.t(
          approved ? "pamExtendLeaseSuccess" : "pamExtendLeasePendingMessage",
        ),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  };
}
