import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, resource } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { lastValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
  private dialogService = inject(DialogService);
  private environmentService = inject(EnvironmentService);

  private readonly account = toSignal(this.accountService.activeAccount$);

  private readonly subscription = resource({
    params: () => ({ account: this.account() }),
    loader: async ({ params: { account } }) => {
      if (!account) {
        return null;
      }
      return await this.apiService.getUserSubscription();
    },
  });

  readonly subscriptionLoading = this.subscription.isLoading;

  readonly expiration = computed(() => this.subscription.value()?.expiration ?? null);

  readonly isActive = computed<boolean>(() => {
    const expiration = this.expiration();
    if (!expiration) {
      return false;
    }
    const expirationDate = new Date(expiration);
    return !isNaN(expirationDate.getTime()) && expirationDate > new Date();
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
