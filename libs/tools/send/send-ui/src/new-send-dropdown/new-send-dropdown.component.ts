import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { BadgeModule, ButtonModule, MenuModule } from "@bitwarden/components";

@Component({
  selector: "tools-new-send-dropdown",
  templateUrl: "new-send-dropdown.component.html",
  standalone: true,
  imports: [JslibModule, CommonModule, ButtonModule, RouterLink, MenuModule, BadgeModule],
})
export class NewSendDropdownComponent implements OnInit {
  @Input() hideIcon: boolean = false;

  sendType = SendType;

  hasNoPremium = false;

  constructor(
    private router: Router,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

  async ngOnInit() {
    this.hasNoPremium = !(await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$,
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
