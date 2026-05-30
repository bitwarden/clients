import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";

import {
  CipherOpenGate,
  CipherOpenVerdict,
} from "../vault/individual-vault/cipher-open-gate";

import { AccessRequestDetailModalComponent } from "./access-request-detail-modal/access-request-detail-modal.component";
import { CipherOpenInterceptorService } from "./cipher-open-interceptor.service";
// DEMO ONLY: gated-ness comes from a deterministic predicate. In production this
// signal is cipher/collection access-rule metadata held client-side.
import { PamMockConfig } from "./mock/pam-mock-config";

@Injectable({ providedIn: "root" })
export class PamCipherOpenGate implements CipherOpenGate {
  constructor(
    private readonly cipherOpenInterceptorService: CipherOpenInterceptorService,
    private readonly dialogService: DialogService,
    private readonly i18nService: I18nService,
  ) {}

  async check(cipher: { id: string }, userId: string): Promise<CipherOpenVerdict> {
    const gated = PamMockConfig.isEnabled() && PamMockConfig.shouldGate(cipher.id);
    const decision = await this.cipherOpenInterceptorService.open({
      cipherId: cipher.id,
      gated,
      userId,
    });

    switch (decision.kind) {
      case "denied":
        await this.dialogService.openSimpleDialog({
          title: { key: "pamAccessDeniedTitle" },
          content:
            decision.reason.length > 0
              ? decision.reason
              : this.i18nService.t("pamAccessDeniedNoReason"),
          type: "warning",
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
        });
        return "handled";
      case "pending":
      case "awaiting_redemption": {
        // Both surface the request modal: a pending request lets the user amend
        // the window; an approved ticket offers "Start access" (redemption).
        const dialogRef = AccessRequestDetailModalComponent.open(this.dialogService, {
          request: decision.request,
        });
        await firstValueFrom(dialogRef.closed);
        return "handled";
      }
      case "reveal":
      case "passthrough":
        return "open";
    }
  }
}
