import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { firstValueFrom, Observable, of, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { BadgeModule, ButtonModule, MenuModule } from "@bitwarden/components";

@Component({
  selector: "tools-new-send-dropdown",
  templateUrl: "new-send-dropdown.component.html",
  standalone: true,
  imports: [JslibModule, CommonModule, ButtonModule, MenuModule, BadgeModule],
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

  /** Emitted when an allowed SendType has been selected. */
  @Output() onCreateSendOfType = new EventEmitter<SendType>();

  constructor(
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private messagingService: MessagingService,
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
   * Emits an event with the user selected SendType, for the hosting control to launch the Add new Send page with the provided SendType.
   * If has user does not have premium access and the type is File, the user will be redirected to the premium settings page.
   * @param type The type of Send to create.
   */
  async createSend(type: SendType) {
    if (!(await firstValueFrom(this.canAccessPremium$)) && type === SendType.File) {
      this.messagingService.send("openPremium");
      return;
    }

    this.onCreateSendOfType.emit(type);
  }
}
