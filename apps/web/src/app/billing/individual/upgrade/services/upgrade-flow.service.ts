import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { DialogRef, DialogService } from "@bitwarden/components";

import { BitwardenSubscriber, mapAccountToSubscriber } from "../../../types";
import {
  UpgradeAccountDialogComponent,
  UpgradeAccountDialogParams,
  UpgradeAccountDialogResult,
  UpgradeAccountDialogStatus,
} from "../upgrade-account-dialog/upgrade-account-dialog.component";
import {
  UpgradePaymentDialogComponent,
  UpgradePaymentDialogParams,
  UpgradePaymentDialogResult,
  UpgradePaymentDialogStatus,
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
    private router: Router,
  ) {
    this.accountService.activeAccount$.pipe(mapAccountToSubscriber).subscribe((subscriber) => {
      this.subscriber = subscriber;
    });
  }

  /**
   * Start the account upgrade flow
   *
   * This method will open the upgrade account dialog and handle the flow
   * between it and the payment dialog if needed. On successful upgrade,
   * it will navigate to the appropriate subscription page.
   *
   * @param autoNavigate Whether to automatically navigate on success (default: true)
   * @param upgradeAccountDialogTitleMessageOverride String value to override the upgrade account
   *  dialog's title with, if provided
   * @returns A promise resolving to the upgrade flow result
   */
  async startUpgradeFlow(
    autoNavigate = true,
    upgradeAccountDialogTitleMessageOverride?: string,
  ): Promise<UpgradeFlowResult> {
    if (!this.subscriber) {
      throw new Error("No active subscriber found for upgrade flow");
    }

    while (true) {
      const accountResult = await this.openUpgradeAccountDialog(
        upgradeAccountDialogTitleMessageOverride,
      );
      if (
        !accountResult ||
        accountResult.status !== UpgradeAccountDialogStatus.ProceededToPayment
      ) {
        return UpgradeFlowResult.Cancelled;
      }

      const paymentResult = await this.openUpgradePaymentDialog(accountResult.plan);
      if (!paymentResult) {
        return UpgradeFlowResult.Cancelled;
      }

      if (paymentResult.status === UpgradePaymentDialogStatus.Back) {
        continue; // Go back to account selection dialog
      }

      return await this.handleUpgradeSuccess(paymentResult, autoNavigate);
    }
  }

  private async openUpgradeAccountDialog(
    dialogTitleMessageOverride?: string,
  ): Promise<UpgradeAccountDialogResult | undefined> {
    this.upgradeToPremiumDialogRef = UpgradeAccountDialogComponent.open(this.dialogService, {
      data: {
        dialogTitleMessageOverride: dialogTitleMessageOverride,
      } as UpgradeAccountDialogParams,
    });
    const result = await lastValueFrom(this.upgradeToPremiumDialogRef.closed);
    this.upgradeToPremiumDialogRef = undefined;
    return result;
  }

  private async openUpgradePaymentDialog(
    plan: any,
  ): Promise<UpgradePaymentDialogResult | undefined> {
    this.upgradePaymentDialogRef = UpgradePaymentDialogComponent.open(this.dialogService, {
      data: {
        plan,
        subscriber: this.subscriber,
      } as UpgradePaymentDialogParams,
    });
    const result = await lastValueFrom(this.upgradePaymentDialogRef.closed);
    this.upgradePaymentDialogRef = undefined;
    return result;
  }

  private async handleUpgradeSuccess(
    paymentResult: UpgradePaymentDialogResult,
    autoNavigate: boolean,
  ): Promise<UpgradeFlowResult> {
    const { status } = paymentResult;

    if (status === UpgradePaymentDialogStatus.UpgradedToPremium) {
      if (autoNavigate) {
        await this.router.navigate(["/settings/subscription"]);
      }
      return UpgradeFlowResult.Upgraded;
    }

    if (status === UpgradePaymentDialogStatus.UpgradedToFamilies && paymentResult.organizationId) {
      if (autoNavigate) {
        await this.router.navigate([
          `/organizations/${paymentResult.organizationId}/billing/subscription`,
        ]);
      }
      return UpgradeFlowResult.Upgraded;
    }

    return UpgradeFlowResult.Cancelled;
  }
}
