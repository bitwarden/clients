import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
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
 * fetch the full cipher under any active lease first. With no lease but an
 * approved (unactivated) request, opening just surfaces the partial view:
 * activation is always an explicit member action (CipherOpenAwaitingActivation),
 * so the cipher-lease banner inside the view owns the "Start access" button and
 * the open never mints the lease. A pending request likewise surfaces the partial
 * view, where the banner owns the "Cancel request" button. Only with no request at
 * all do we surface the request-access modal, and after it closes with a fresh
 * automatic lease we re-fetch the same way. The leased Cipher is never persisted to
 * local state.
 */
@Injectable({ providedIn: "root" })
export class PamCipherOpenGate implements CipherOpenGate {
  constructor(
    private readonly configService: ConfigService,
    private readonly leasedCipherFetcher: LeasedCipherFetcher,
    private readonly requestAccessTrigger: RequestAccessTrigger,
    private readonly pamApiService: PamApiService,
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

    // No active lease. Only the access-state snapshot knows whether an approved request exists.
    let state: CipherAccessState = {};
    try {
      state = await firstValueFrom(this.pamApiService.getCipherAccessState$(cipher.id, userId));
    } catch (e) {
      // Degraded: without the snapshot we fall through to the request flow below.
      this.logService.error(e);
    }

    if (state.approvedRequest != null) {
      // Approved but unactivated: opening must never mint the lease — activation is always an
      // explicit member action (CipherOpenAwaitingActivation). Open the partial view; the
      // cipher-lease banner renders the approved state and owns the "Start access" button.
      return "open";
    }

    if (state.pendingRequest != null) {
      // A request is already awaiting approval: driving a fresh request flow would only hit the
      // server's "already pending" rejection. Open the partial view instead; the cipher-lease
      // banner renders the pending state and owns the "Cancel request" button.
      return "open";
    }

    // No lease and no request yet — drive the request-access flow.
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
