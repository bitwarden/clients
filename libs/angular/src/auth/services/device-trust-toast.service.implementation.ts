import { merge, Observable, tap } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { DeviceTrustToastService as DeviceTrustToastServiceAbstraction } from "./device-trust-toast.service.abstraction";

export class DeviceTrustToastService implements DeviceTrustToastServiceAbstraction {
  private adminLoginApproved$: Observable<void>;
  private deviceTrusted$: Observable<void>;

  setupListeners$: Observable<void>;

  constructor(
    private authRequestService: AuthRequestServiceAbstraction,
    private deviceTrustService: DeviceTrustServiceAbstraction,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {
    this.adminLoginApproved$ = this.authRequestService.adminLoginApproved$.pipe(
      tap(() => {
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("loginApproved"),
        });
      }),
    );

    this.deviceTrusted$ = this.deviceTrustService.deviceTrusted$.pipe(
      tap(() => {
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("deviceTrusted"),
        });
      }),
    );

    this.setupListeners$ = merge(this.adminLoginApproved$, this.deviceTrusted$);
  }
}
