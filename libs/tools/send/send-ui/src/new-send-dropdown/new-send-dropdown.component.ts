import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ButtonModule, ButtonType, IconModule, MenuModule } from "@bitwarden/components";

import { SendPolicyService } from "../services/send-policy.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-new-send-dropdown",
  templateUrl: "new-send-dropdown.component.html",
  imports: [
    JslibModule,
    CommonModule,
    ButtonModule,
    RouterLink,
    MenuModule,
    PremiumBadgeComponent,
    IconModule,
  ],
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

  protected readonly allowedSendTypes = toSignal(this.sendPolicyService.allowedSendTypes$, {
    initialValue: [SendType.Text, SendType.File],
  });

  constructor(
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private router: Router,
    private premiumUpgradePromptService: PremiumUpgradePromptService,
    private sendPolicyService: SendPolicyService,
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

  /** Called when the type is restricted — directly creates the allowed type. */
  protected async onRestrictedClick(): Promise<void> {
    const allowedSendTypes = this.allowedSendTypes();
    if (allowedSendTypes[0] === SendType.File) {
      await this.sendFileClick();
    } else if (allowedSendTypes[0] === SendType.Text) {
      await this.router.navigate([this.buildRouterLink()], {
        queryParams: this.buildQueryParams(SendType.Text),
      });
    }
  }
}
