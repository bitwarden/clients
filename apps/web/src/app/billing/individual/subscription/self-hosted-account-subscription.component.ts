import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, resource } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { lastValueFrom, map, of, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import {
  BadgeModule,
  BaseCardComponent,
  ButtonModule,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { UpdateLicenseDialogComponent } from "../../shared/update-license-dialog.component";
import { UpdateLicenseDialogResult } from "../../shared/update-license-types";

@Component({
  templateUrl: "./self-hosted-account-subscription.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeModule, BaseCardComponent, ButtonModule, DatePipe, I18nPipe, TypographyModule],
})
export class SelfHostedAccountSubscriptionComponent {
  private accountService = inject(AccountService);
  private apiService = inject(ApiService);
  private billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private dialogService = inject(DialogService);
  private environmentService = inject(EnvironmentService);
  private router = inject(Router);

  private readonly account = toSignal(this.accountService.activeAccount$);

  private readonly hasPremiumPersonally = toSignal(
    this.accountService.activeAccount$.pipe(
      switchMap((account) => {
        if (!account) {
          return of(false);
        }
        return this.billingAccountProfileStateService.hasPremiumPersonally$(account.id);
      }),
    ),
    { initialValue: false },
  );

  private readonly subscription = resource({
    params: () => ({
      account: this.account(),
      hasPremiumPersonally: this.hasPremiumPersonally(),
    }),
    loader: async ({ params: { account, hasPremiumPersonally } }) => {
      if (!account || !hasPremiumPersonally) {
        await this.router.navigate(["/settings/subscription/premium"]);
        return null;
      }
      return await this.apiService.getUserSubscription();
    },
  });

  readonly subscriptionLoading = this.subscription.isLoading;

  readonly expiration = computed(() => this.subscription.value()?.expiration ?? null);

  readonly isActive = computed<boolean>(() => {
    const expiration = this.expiration();
    if (!expiration || expiration.trim() === "") {
      return true;
    }
    const expirationDate = new Date(expiration);
    if (isNaN(expirationDate.getTime())) {
      return true;
    }
    return expirationDate > new Date();
  });

  readonly cloudSubscriptionUrl = toSignal(
    this.environmentService.cloudWebVaultUrl$.pipe(map((url) => `${url}/#/settings/subscription`)),
    { initialValue: "" },
  );

  async updateLicense(): Promise<void> {
    const dialogRef = UpdateLicenseDialogComponent.open(this.dialogService, {
      data: { fromUserSubscriptionPage: true },
    });
    const result = await lastValueFrom(dialogRef.closed);
    if (result === UpdateLicenseDialogResult.Updated) {
      this.subscription.reload();
    }
  }
}
