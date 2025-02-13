import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, Observable, of, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { BadgeModule, ButtonModule, DialogService, MenuModule } from "@bitwarden/components";
import { DefaultSendFormConfigService } from "@bitwarden/send-ui";

import { SendAddEditComponent } from "../send-add-edit.component";

@Component({
  selector: "tools-new-send-dropdown",
  templateUrl: "new-send-dropdown.component.html",
  standalone: true,
  imports: [JslibModule, CommonModule, ButtonModule, MenuModule, BadgeModule],
  providers: [DefaultSendFormConfigService],
})
export class NewSendDropdownComponent implements OnInit {
  @Input() hideIcon: boolean = false;

  sendType = SendType;

  /** Indicates whether the user can access premium features. */
  protected canAccessPremium$: Observable<boolean>;

  constructor(
    private router: Router,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private dialogService: DialogService,
    private addEditFormConfigService: DefaultSendFormConfigService,
  ) {}

  async ngOnInit() {
    this.canAccessPremium$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        account
          ? this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id)
          : of(false),
      ),
    );
  }

  async createSend(type: SendType) {
    if (!(await firstValueFrom(this.canAccessPremium$)) && type === SendType.File) {
      return await this.router.navigate(["settings/subscription/premium"]);
    }

    const formConfig = await this.addEditFormConfigService.buildConfig("add", undefined, type);

    await SendAddEditComponent.open(this.dialogService, { formConfig });
  }
}
