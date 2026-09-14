import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { map, of, switchMap } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { IconModule, MenuModule } from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";
import { VaultFabComponent } from "@bitwarden/vault";

@Component({
  selector: "app-send-fab",
  templateUrl: "send-fab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, VaultFabComponent, MenuModule, IconModule, PremiumBadgeComponent],
})
export class SendFabComponent {
  private readonly router = inject(Router);
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private readonly accountService = inject(AccountService);
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly sendPolicyService = inject(SendPolicyService);

  protected readonly sendType = SendType;

  protected readonly allowedSendTypes = toSignal(this.sendPolicyService.allowedSendTypes$, {
    initialValue: [SendType.Text, SendType.File],
  });

  protected readonly hasNoPremium = toSignal(
    this.accountService.activeAccount$.pipe(
      switchMap((account) => {
        if (!account) {
          return of(true);
        }
        return this.billingAccountProfileStateService
          .hasPremiumFromAnySource$(account.id)
          .pipe(map((hasPremium) => !hasPremium));
      }),
    ),
    { initialValue: true },
  );

  protected async navigateToTextSend(): Promise<void> {
    await this.router.navigate(["/add-send"], {
      queryParams: { type: SendType.Text, isNew: true },
    });
  }

  protected async navigateToFileSend(): Promise<void> {
    if (this.hasNoPremium()) {
      await this.premiumUpgradePromptService.promptForPremium();
      return;
    }
    await this.router.navigate(["/add-send"], {
      queryParams: { type: SendType.File, isNew: true },
    });
  }

  protected async navigateToRestrictedSend(): Promise<void> {
    const [allowed] = this.allowedSendTypes();
    if (allowed === SendType.File) {
      await this.navigateToFileSend();
    } else {
      await this.navigateToTextSend();
    }
  }
}
