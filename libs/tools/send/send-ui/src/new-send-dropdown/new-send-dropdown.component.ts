import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { BadgeModule, ButtonModule, ButtonType, MenuModule } from "@bitwarden/components";

@Component({
  selector: "tools-new-send-dropdown",
  templateUrl: "new-send-dropdown.component.html",
  imports: [JslibModule, CommonModule, ButtonModule, RouterLink, MenuModule, BadgeModule],
})
export class NewSendDropdownComponent implements OnInit {
  @Input() hideIcon: boolean = false;
  @Input() buttonType: ButtonType = "primary";

  sendType = SendType;

  hasNoPremium = false;

  constructor(
    private router: Router,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
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

  buildRouterLink(type: SendType) {
    if (this.hasNoPremium && type === SendType.File) {
      return "/premium";
    } else {
      return "/add-send";
    }
  }

  buildQueryParams(type: SendType) {
    if (this.hasNoPremium && type === SendType.File) {
      return null;
    }
    return { type: type, isNew: true };
  }
}
