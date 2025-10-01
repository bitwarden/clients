import { Injectable } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { DialogRef, DialogService } from "@bitwarden/components";

import { BitwardenSubscriber, mapAccountToSubscriber } from "../../../types";
import {
  UpgradeAccountDialogComponent,
  UpgradeAccountDialogResult,
  UpgradeAccountDialogStatus,
} from "../upgrade-account-dialog/upgrade-account-dialog.component";
import {
  UpgradePaymentDialogComponent,
  UpgradePaymentDialogParams,
  UpgradePaymentDialogResult,
} from "../upgrade-payment-dialog/upgrade-payment-dialog.component";

export const UpgradeFlowResult = {
  Upgraded: "upgraded",
  Cancelled: "cancelled",
} as const;

export type UpgradeFlowResult = UnionOfValues<typeof UpgradeFlowResult>;

/**
 * Service to manage the account upgrade flow through multiple dialogs
 */
@Injectable({ providedIn: "root" })
export class UpgradeFlowService {
  // References to open dialogs
  private upgradeToPremiumDialogRef?: DialogRef<UpgradeAccountDialogResult>;
  private upgradePaymentDialogRef?: DialogRef<UpgradePaymentDialogResult>;
  private subscriber: BitwardenSubscriber | null = null;

  constructor(
    private dialogService: DialogService,
    private accountService: AccountService,
  ) {
    this.accountService.activeAccount$.pipe(mapAccountToSubscriber).subscribe((subscriber) => {
      this.subscriber = subscriber;
    });
  }

  /**
   * Start the account upgrade flow
   *
   * This method will open the upgrade account dialog and handle the flow
   * between it and the payment dialog if needed.
   *
   * @returns A promise resolving to the upgrade flow result
   */
  async startUpgradeFlow(): Promise<UpgradeFlowResult> {
    // Get subscriber information from account service
    if (!this.subscriber) {
      throw new Error("No active subscriber found for upgrade flow");
    }
    // Start the upgrade dialog flow
    while (true) {
      // Open the upgrade account dialog
      this.upgradeToPremiumDialogRef = UpgradeAccountDialogComponent.open(this.dialogService);
      const dialogResult = await lastValueFrom(this.upgradeToPremiumDialogRef.closed);
      // Clear the reference to the upgrade dialog
      this.upgradeToPremiumDialogRef = undefined;

      if (!dialogResult) {
        return UpgradeFlowResult.Cancelled;
      }

      // If the dialog was closed without proceeding to payment
      if (dialogResult.status !== UpgradeAccountDialogStatus.ProceededToPayment) {
        return UpgradeFlowResult.Cancelled;
      }

      // If user proceeded to payment
      if (dialogResult.status === UpgradeAccountDialogStatus.ProceededToPayment) {
        this.upgradePaymentDialogRef = UpgradePaymentDialogComponent.open(this.dialogService, {
          data: {
            plan: dialogResult.plan,
            subscriber: this.subscriber,
          } as UpgradePaymentDialogParams,
        });
        const paymentResult = await lastValueFrom(this.upgradePaymentDialogRef.closed);
        this.upgradePaymentDialogRef = undefined;

        if (!paymentResult) {
          return UpgradeFlowResult.Cancelled;
        }

        // If user clicked "Back", continue the loop to reopen the first dialog
        if (paymentResult === UpgradePaymentDialogResult.Back) {
          continue;
        }

        // Handle successful payment outcomes
        if (paymentResult === UpgradePaymentDialogResult.UpgradedToPremium) {
          return UpgradeFlowResult.Upgraded;
        } else if (paymentResult === UpgradePaymentDialogResult.UpgradedToFamilies) {
          return UpgradeFlowResult.Upgraded;
        } else {
          return UpgradeFlowResult.Cancelled;
        }
      }

      // Exit the loop for all other cases
      return UpgradeFlowResult.Cancelled;
    }
  }
}
