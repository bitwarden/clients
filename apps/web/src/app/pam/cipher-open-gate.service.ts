import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";
import {
  CipherAccessState,
  LeasedCipherFetcher,
  PamApiService,
  RequestAccessTrigger,
} from "@bitwarden/pam";

import {
  CipherOpenGate,
  CipherOpenVerdict,
  GatedCipherLike,
} from "../vault/individual-vault/cipher-open-gate";

/**
 * Decides what happens when a user clicks a PAM-gated cipher row.
 *
 * `partialData != null` is the gating signal: the server delivered only name +
 * URIs because the caller doesn't currently hold a covering lease. We try to
 * fetch the full cipher under any active lease first. With no lease, a
 * startable approved request is activated right here — opening the item is
 * the access that mints the lease — and the freshly-leased cipher is handed
 * back via `openWith`. Otherwise we surface the request-access modal, and
 * after it closes with a fresh automatic lease we re-fetch the same way. The
 * leased Cipher is never persisted to local state.
 */
@Injectable({ providedIn: "root" })
export class PamCipherOpenGate implements CipherOpenGate {
  constructor(
    private readonly configService: ConfigService,
    private readonly leasedCipherFetcher: LeasedCipherFetcher,
    private readonly requestAccessTrigger: RequestAccessTrigger,
    private readonly pamApiService: PamApiService,
    private readonly toastService: ToastService,
    private readonly i18nService: I18nService,
    private readonly logService: LogService,
  ) {}

  async check(cipher: GatedCipherLike, userId: string): Promise<CipherOpenVerdict> {
    if (cipher.partialData == null) {
      // Not gated, or caller already holds an active lease (full data delivered).
      return "open";
    }
    const flagOn = await this.configService.getFeatureFlag(FeatureFlag.Pam);
    if (!flagOn) {
      return "open";
    }

    const fetched = await this.leasedCipherFetcher.fetch(cipher.id);
    if (fetched != null) {
      return { kind: "openWith", cipher: fetched };
    }

    // No active lease. Only the access-state snapshot knows whether a startable approved request exists.
    let state: CipherAccessState = {};
    try {
      state = await firstValueFrom(this.pamApiService.getCipherAccessState$(cipher.id, userId));
    } catch (e) {
      // Degraded: without the snapshot we can't activate, but the request flow below still works.
      this.logService.error(e);
    }

    const approved = state.approvedRequest;
    if (approved != null) {
      const windowStarted =
        approved.requestedNotBefore == null ||
        new Date(approved.requestedNotBefore).getTime() <= Date.now();
      if (!windowStarted) {
        // Approved for a window that hasn't opened: nothing to activate yet. Open the partial view —
        // the lease banner renders the approved state and its upcoming window.
        return "open";
      }
      try {
        await this.pamApiService.activateLease(approved.id);
        const activated = await this.leasedCipherFetcher.fetch(cipher.id);
        if (activated != null) {
          // Opening the item is what minted the lease — say so, or the start is invisible and an
          // approved item looks like it was already active.
          this.toastService.showToast({
            variant: "success",
            message: this.i18nService.t("pamStartLeaseSuccess"),
          });
          return { kind: "openWith", cipher: activated };
        }
        // Activated, but the rule's conditions (IP, time of day) deny the handover right now.
        return "handled";
      } catch (e) {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamStartLeaseError"),
        });
        // Don't fall through to the request modal: a fresh submit is rejected while the approved
        // request exists.
        return "handled";
      }
    }

    // Pending request or nothing yet — drive the request-access flow.
    const outcome = await this.requestAccessTrigger.requestAccess(cipher.id);
    if (outcome === "lease-created") {
      const afterLease = await this.leasedCipherFetcher.fetch(cipher.id);
      if (afterLease != null) {
        return { kind: "openWith", cipher: afterLease };
      }
    }
    // request-created (awaiting human approval) or dismissed → don't open the view.
    return "handled";
  }
}
