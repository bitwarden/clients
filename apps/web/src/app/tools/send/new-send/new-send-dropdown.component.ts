import { Component, Input } from "@angular/core";
import { firstValueFrom, Observable, of, switchMap, lastValueFrom } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import {
  ButtonModule,
  DialogRef,
  DialogService,
  IconComponent,
  MenuModule,
} from "@bitwarden/components";
import {
  DefaultSendFormConfigService,
  SendAddEditDialogComponent,
  SendFormService,
  SendItemDialogResult,
} from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendSuccessDrawerDialogComponent } from "../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-new-send-dropdown",
  templateUrl: "new-send-dropdown.component.html",
  imports: [I18nPipe, ButtonModule, MenuModule, PremiumBadgeComponent, IconComponent],
  providers: [DefaultSendFormConfigService],
})
/**
 * A dropdown component that allows the user to create a new Send of a specific type.
 */
export class NewSendDropdownComponent {
  /** If true, the plus icon will be hidden */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() hideIcon: boolean = false;

  /** SendType provided for the markup to pass back the selected type of Send */
  protected sendType = SendType;

  /** Indicates whether the user can access premium features. */
  protected canAccessPremium$: Observable<boolean>;

  private sendFormDialogRef?: DialogRef<SendItemDialogResult, SendAddEditDialogComponent>;

  constructor(
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private dialogService: DialogService,
    private addEditFormConfigService: DefaultSendFormConfigService,
    private configService: ConfigService,
    private sendFormService: SendFormService,
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
    const useRefresh = await this.configService.getFeatureFlag(FeatureFlag.SendUIRefresh);
    if (useRefresh) {
      const sendFormDialogRef = await SendAddEditDialogComponent.openDrawer(this.dialogService, {
        formConfig,
        closePredicate: this.sendFormService.promptForUnsavedEdits.bind(this.sendFormService),
      });
      if (sendFormDialogRef) {
        this.sendFormDialogRef = sendFormDialogRef;
        const result = await lastValueFrom(this.sendFormDialogRef.closed);
        if (result?.result === SendItemDialogResult.Saved && result?.send) {
          await this.dialogService.openDrawer(SendSuccessDrawerDialogComponent, {
            data: result.send,
          });
        }
      }
    } else {
      SendAddEditDialogComponent.open(this.dialogService, {
        formConfig,
        closePredicate: this.sendFormService.promptForUnsavedEdits.bind(this.sendFormService),
      });
    }
  }

  async saveUnsavedSendEdits() {
    if (this.sendFormDialogRef) {
      const closeResult = await this.sendFormDialogRef.close();
      return closeResult.closed;
    }
    return true;
  }
}
