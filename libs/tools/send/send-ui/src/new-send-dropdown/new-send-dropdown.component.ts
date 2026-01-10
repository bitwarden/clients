import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ButtonModule, ButtonType, MenuModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-new-send-dropdown",
  templateUrl: "new-send-dropdown.component.html",
  imports: [JslibModule, CommonModule, ButtonModule, RouterLink, MenuModule, PremiumBadgeComponent],
})
export class NewSendDropdownComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() hideIcon: boolean = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() buttonType: ButtonType = "primary";

  sendType = SendType;

  hasNoPremium = false;

  constructor(
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private router: Router,
    private premiumUpgradePromptService: PremiumUpgradePromptService,
  ) {}

  async ngOnInit() {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      this.hasNoPremium = true;
      return;
    }

    this.hasNoPremium = !(await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    ));
  }

  buildRouterLink() {
    return "/add-send";
  }

  buildQueryParams(type: SendType) {
    return { type: type, isNew: true };
  }

  async sendFileClick() {
    if (this.hasNoPremium) {
      await this.premiumUpgradePromptService.promptForPremium();
    } else {
      await this.router.navigate([this.buildRouterLink()], {
        queryParams: this.buildQueryParams(SendType.File),
      });
    }
  }
}
