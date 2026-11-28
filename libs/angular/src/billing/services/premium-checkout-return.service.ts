import { inject, Injectable, NgZone } from "@angular/core";
import { filter, firstValueFrom, take, takeUntil } from "rxjs";

import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PremiumCheckoutPendingService } from "@bitwarden/common/billing/abstractions/account/premium-checkout-pending.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import { PremiumCheckoutProcessingComponent } from "../components/premium-checkout-processing/premium-checkout-processing.component";

@Injectable()
export class PremiumCheckoutReturnService {
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly ngZone = inject(NgZone);
  private readonly premiumCheckoutPendingService = inject(PremiumCheckoutPendingService);
  private readonly syncService = inject(SyncService);
  private readonly toastService = inject(ToastService);

  private handling = false;

  async handleReturn(userId: UserId): Promise<void> {
    if (this.handling) {
      return;
    }
    this.handling = true;
    try {
      await this.reconcile(userId);
    } finally {
      this.handling = false;
    }
  }

  private async reconcile(userId: UserId): Promise<void> {
    const pending = await this.premiumCheckoutPendingService.getCheckoutPending(userId);
    if (pending == null) {
      return;
    }

    // Sync even if Premium is already reflected; desktop only refreshes its app menu after a sync.
    await this.syncService.fullSync(true);
    await this.premiumCheckoutPendingService.clearCheckoutPending(userId);

    const featureNameKey = pending.featureNameKey;
    if (featureNameKey == null) {
      return;
    }
    if (await this.hasPremium(userId)) {
      this.showUpgradedToast();
      return;
    }
    this.openProcessingSurface(userId, featureNameKey);
  }

  private openProcessingSurface(userId: UserId, featureNameKey: string): void {
    const dialogRef = PremiumCheckoutProcessingComponent.open(this.dialogService, {
      featureNameKey,
    });
    this.billingAccountProfileStateService
      .hasPremiumFromAnySource$(userId)
      .pipe(
        filter((hasPremium) => hasPremium),
        take(1),
        takeUntil(dialogRef.closed),
      )
      .subscribe(() =>
        // State updates in the browser extension can arrive outside the Angular zone.
        this.ngZone.run(() => {
          this.showUpgradedToast();
          void dialogRef.close();
        }),
      );
  }

  private hasPremium(userId: UserId): Promise<boolean> {
    return firstValueFrom(this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId));
  }

  private showUpgradedToast(): void {
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("upgradedToPremium"),
    });
  }
}
