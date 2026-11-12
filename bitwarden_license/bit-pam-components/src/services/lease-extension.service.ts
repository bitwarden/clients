import { firstValueFrom } from "rxjs";

import {
  AccessLeaseId,
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  isUnlicensedError,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { ExtendLeaseDialogComponent } from "../access-requests/extend-lease-dialog/extend-lease-dialog.component";

/**
 * Extends the caller's own lease on a gated cipher, for surfaces that list leases rather than open
 * the item. Whether a lease may be extended, and by how much, is the access rule's call, so both
 * questions are answered from a fresh read of the cipher's access state.
 */
export class LeaseExtensionService {
  constructor(
    private readonly accessRequestSdkService: AccessRequestSdkService,
    private readonly accessLeaseSdkService: AccessLeaseSdkService,
    private readonly accessRefreshService: AccessRefreshService,
    private readonly dialogService: DialogService,
    private readonly toastService: ToastService,
    private readonly i18nService: I18nService,
    private readonly logService: LogService,
  ) {}

  /**
   * The longest extension the cipher's rule allows, or null when it allows none or the state can't
   * be read. Never rejects; an unreadable state simply offers no extension.
   */
  async maxExtensionSeconds(cipherId: string): Promise<number | null> {
    try {
      const state = await this.accessRequestSdkService.getCipherAccessState(cipherId);
      return state.extensionsAllowed === true ? (state.maxExtensionDurationSeconds ?? null) : null;
    } catch (e) {
      this.logService.error(e);
      return null;
    }
  }

  /**
   * Asks for a length and a reason, then extends. A denied extension resolves rather than throws,
   * so the returned status picks the toast; without that an expired-lease denial would read as
   * success. Never rejects; the outcome is toasted and the refresh always announced once asked.
   */
  async extend(
    cipherId: string,
    leaseId: AccessLeaseId,
    maxDurationSeconds: number,
  ): Promise<void> {
    const request = await firstValueFrom(
      ExtendLeaseDialogComponent.open(this.dialogService, { maxDurationSeconds }).closed,
    );
    if (request == null) {
      return;
    }
    try {
      const extension = await this.accessLeaseSdkService.extendLease(leaseId, request);
      const denied = extension.status === "denied";
      this.toastService.showToast({
        variant: denied ? "warning" : "success",
        message: this.i18nService.t(denied ? "pamExtendLeaseEnded" : "pamExtendLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(
          isUnlicensedError(e) ? "pamLeaseErrorUnlicensed" : "pamExtendLeaseError",
        ),
      });
    } finally {
      this.accessRefreshService.notifyAccessChanged(cipherId);
    }
  }
}
