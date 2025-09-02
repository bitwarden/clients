import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { firstValueFrom, Observable, of, switchMap } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { BadgeModule, ButtonModule, DialogService, MenuModule } from "@bitwarden/components";
import { DefaultSendFormConfigService, SendAddEditDialogComponent } from "@bitwarden/send-ui";

@Component({
  selector: "tools-new-send-dropdown",
  templateUrl: "new-send-dropdown.component.html",
  imports: [
    JslibModule,
    CommonModule,
    ButtonModule,
    MenuModule,
    BadgeModule,
    PremiumBadgeComponent,
  ],
  providers: [DefaultSendFormConfigService],
})
/**
 * A dropdown component that allows the user to create a new Send of a specific type.
 */
export class NewSendDropdownComponent {
  /** If true, the plus icon will be hidden */
  @Input() hideIcon: boolean = false;

  /** SendType provided for the markup to pass back the selected type of Send */
  protected sendType = SendType;

  /** Indicates whether the user can access premium features. */
  protected canAccessPremium$: Observable<boolean>;

  constructor(
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private dialogService: DialogService,
    private addEditFormConfigService: DefaultSendFormConfigService,
  ) {
    this.canAccessPremium$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        account
          ? this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id)
          : of(false),
      ),
    );
  }

  /**
   * Opens the SendAddEditComponent for a new Send with the provided type.
   * If has user does not have premium access and the type is File do nothing the PremiumBadgeComponent will handle the flow.
   * @param type The type of Send to create.
   */
  async createSend(type: SendType) {
    if (!(await firstValueFrom(this.canAccessPremium$)) && type === SendType.File) {
      return;
    }

    const formConfig = await this.addEditFormConfigService.buildConfig("add", undefined, type);

    SendAddEditDialogComponent.open(this.dialogService, { formConfig });
  }
}
