import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map, of, switchMap } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ButtonModule, ButtonType, MenuModule } from "@bitwarden/components";

// Desktop-specific version of NewSendDropdownComponent.
// Unlike the shared library version, this component emits events instead of using Angular Router,
// which aligns with Desktop's modal-based architecture.
@Component({
  selector: "tools-new-send-dropdown-v2",
  templateUrl: "new-send-dropdown-v2.component.html",
  imports: [JslibModule, ButtonModule, MenuModule, PremiumBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewSendDropdownV2Component {
  readonly hideIcon = input<boolean>(false);
  readonly buttonType = input<ButtonType>("primary");

  readonly addSend = output<SendType>();
  readonly addFolderSend = output<void>();

  protected readonly sendType = SendType;

  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly accountService = inject(AccountService);
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private readonly configService = inject(ConfigService);

  protected readonly showFolderOption = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.SendFolder),
    { initialValue: false },
  );

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

  protected onTextSendClick(): void {
    this.addSend.emit(SendType.Text);
  }

  protected async onFileSendClick(): Promise<void> {
    if (this.hasNoPremium()) {
      await this.premiumUpgradePromptService.promptForPremium();
    } else {
      this.addSend.emit(SendType.File);
    }
  }

  protected async onFolderSendClick(): Promise<void> {
    if (this.hasNoPremium()) {
      await this.premiumUpgradePromptService.promptForPremium();
    } else {
      this.addFolderSend.emit();
    }
  }
}
