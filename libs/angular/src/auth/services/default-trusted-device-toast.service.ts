import { merge } from "rxjs";

import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";

import { TrustedDeviceToastService } from "./trusted-device-toast.service";

export class DefaultTrustedDeviceToastService implements TrustedDeviceToastService {
  adminLoginApproved$ = this.authRequestService.adminLoginApproved$;
  deviceTrusted$ = this.deviceTrustService.deviceTrusted$;

  setupListeners$ = merge(
    this.authRequestService.adminLoginApproved$,
    this.deviceTrustService.deviceTrusted$,
  );

  constructor(
    private authRequestService: AuthRequestServiceAbstraction,
    private deviceTrustService: DeviceTrustServiceAbstraction,
  ) {}
}
