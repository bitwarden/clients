import { merge, Observable } from "rxjs";

import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";

import { DeviceTrustToastService as DeviceTrustToastServiceAbstraction } from "./device-trust-toast.service.abstraction";

export class DeviceTrustToastService implements DeviceTrustToastServiceAbstraction {
  /**
   * Subscribes to any cross-application toast messages that need to be shown
   * as part of the TDE process.
   */
  setupListeners$: Observable<string>;

  constructor(
    private authRequestService: AuthRequestServiceAbstraction,
    private deviceTrustService: DeviceTrustServiceAbstraction,
  ) {
    this.setupListeners$ = merge(
      this.authRequestService.adminLoginApproved$,
      this.deviceTrustService.deviceTrusted$,
    );
  }
}
