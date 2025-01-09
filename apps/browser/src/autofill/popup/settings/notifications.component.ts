import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserNotificationSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/user-notification-settings.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import {
  ItemModule,
  CardComponent,
  SectionComponent,
  SectionHeaderComponent,
  CheckboxModule,
  TypographyModule,
  FormFieldModule,
} from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "notifications.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    PopOutComponent,
    ItemModule,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    CheckboxModule,
    TypographyModule,
    FormFieldModule,
    FormsModule,
  ],
})
export class NotificationsSettingsComponent implements OnInit {
  enableAddLoginNotification = false;
  enableChangedPasswordNotification = false;
  enablePasskeys = true;

  constructor(
    private userNotificationSettingsService: UserNotificationSettingsServiceAbstraction,
    private vaultSettingsService: VaultSettingsService,
  ) {}

  async ngOnInit() {
    this.enableAddLoginNotification = await firstValueFrom(
      this.userNotificationSettingsService.enableAddedLoginPrompt$,
    );

    this.enableChangedPasswordNotification = await firstValueFrom(
      this.userNotificationSettingsService.enableChangedPasswordPrompt$,
    );

    this.enablePasskeys = await firstValueFrom(this.vaultSettingsService.enablePasskeys$);
  }

  async updateAddLoginNotification() {
    await this.userNotificationSettingsService.setEnableAddedLoginPrompt(
      this.enableAddLoginNotification,
    );
  }

  async updateChangedPasswordNotification() {
    await this.userNotificationSettingsService.setEnableChangedPasswordPrompt(
      this.enableChangedPasswordNotification,
    );
  }

  async updateEnablePasskeys() {
    await this.vaultSettingsService.setEnablePasskeys(this.enablePasskeys);
  }
}
