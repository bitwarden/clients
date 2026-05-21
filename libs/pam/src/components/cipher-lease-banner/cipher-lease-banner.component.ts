import { Component, DestroyRef, OnInit, computed, inject, input, signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CipherLeaseState, PamApiService } from "../../abstractions/pam-api.service";
import { LeaseExtensionRequest } from "../../services/requests/lease-extension.request";
import { LeaseRevokeRequest } from "../../services/requests/lease-revoke.request";

@Component({
  selector: "app-cipher-lease-banner",
  templateUrl: "cipher-lease-banner.component.html",
  imports: [AsyncActionsModule, ButtonModule, IconButtonModule, I18nPipe],
})
export class CipherLeaseBannerComponent implements OnInit {
  readonly cipherId = input.required<string>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly nowMs = signal(Date.now());
  private readonly pamApiService = inject(PamApiService);
  private readonly toastService = inject(ToastService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly accountService = inject(AccountService);

  protected readonly state = toSignal(
    combineLatest([
      toObservable(this.cipherId),
      getUserId(this.accountService.activeAccount$),
    ]).pipe(
      switchMap(([cipherId, userId]) =>
        this.pamApiService.getCipherLeaseState$(cipherId, userId),
      ),
    ),
    { initialValue: {} as CipherLeaseState },
  );

  protected readonly activeLease = computed(() => this.state().activeLease);
  protected readonly pendingRequest = computed(() => this.state().pendingRequest);

  readonly leaseRemainingLabel = computed(() => {
    const lease = this.activeLease();
    if (!lease) {
      return "";
    }
    const remaining = Math.max(0, Date.parse(lease.notAfter) - this.nowMs());
    const totalSeconds = Math.ceil(remaining / 1000);
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const totalMinutes = Math.ceil(totalSeconds / 60);
    if (totalMinutes < 60) {
      return `${totalMinutes}m`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes - hours * 60;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  });

  ngOnInit(): void {
    const intervalId = setInterval(() => this.nowMs.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  cancelLeaseRequest = async () => {
    const request = this.pendingRequest();
    if (!request) {
      return;
    }
    try {
      await this.pamApiService.cancelLeaseRequest(request.id);
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

  endLease = async () => {
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

  extendLease = async () => {
    const lease = this.activeLease();
    if (!lease) {
      return;
    }
    const currentNotAfter = new Date(lease.notAfter);
    const newNotAfter = new Date(currentNotAfter.getTime() + 60 * 60 * 1000);
    try {
      await this.pamApiService.requestLeaseExtension(
        new LeaseExtensionRequest({
          leaseId: lease.id,
          notBefore: currentNotAfter,
          notAfter: newNotAfter,
        }),
      );
      lease.notAfter = newNotAfter.toISOString();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamExtendLeaseSuccess"),
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
