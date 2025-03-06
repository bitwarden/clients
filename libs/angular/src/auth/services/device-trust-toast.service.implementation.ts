import { merge, Observable, tap } from "rxjs";

import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { DeviceTrustToastService as DeviceTrustToastServiceAbstraction } from "./device-trust-toast.service.abstraction";

export class DeviceTrustToastService implements DeviceTrustToastServiceAbstraction {
  private adminLoginApproved$: Observable<boolean>;
  private deviceTrusted$: Observable<boolean>;

  setupListeners$: Observable<boolean>;

  constructor(
    private authRequestService: AuthRequestServiceAbstraction,
    private deviceTrustService: DeviceTrustServiceAbstraction,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {
    this.adminLoginApproved$ = this.authRequestService.adminLoginApproved$.pipe(
      tap((loginApproved: boolean) => {
        if (loginApproved) {
          this.toastService.showToast({
            variant: "success",
            title: "",
            message: this.i18nService.t("loginApproved"),
          });
        }
      }),
    );

    this.deviceTrusted$ = this.deviceTrustService.deviceTrusted$.pipe(
      tap((deviceTrusted: boolean) => {
        if (deviceTrusted) {
          this.toastService.showToast({
            variant: "success",
            title: "",
            message: this.i18nService.t("deviceTrusted"),
          });
        }
      }),
    );

    this.setupListeners$ = merge(this.adminLoginApproved$, this.deviceTrusted$);
  }
}
