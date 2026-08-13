// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy } from "@angular/core";
import { RouterModule, Router } from "@angular/router";

import { BitwardenShield, NoResults } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  BadgeModule,
  ButtonModule,
  DialogModule,
  SvgModule,
  ItemModule,
  SectionComponent,
  TableModule,
  SectionHeaderComponent,
  BitIconButtonComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";
import {
  DesktopFido2UserInterfaceService,
  DesktopFido2UserInterfaceSession,
} from "../../services/desktop-fido2-user-interface.service";

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SectionHeaderComponent,
    BitIconButtonComponent,
    TableModule,
    I18nPipe,
    SvgModule,
    ButtonModule,
    DialogModule,
    SectionComponent,
    ItemModule,
    BadgeModule,
  ],
  templateUrl: "fido2-excluded-ciphers.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fido2ExcludedCiphersComponent implements OnInit, OnDestroy {
  session?: DesktopFido2UserInterfaceSession = null;
  readonly Icons = { BitwardenShield, NoResults };

  constructor(
    private readonly desktopSettingsService: DesktopSettingsService,
    private readonly fido2UserInterfaceService: DesktopFido2UserInterfaceService,
    private readonly accountService: AccountService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.session = this.fido2UserInterfaceService.getCurrentSession();
  }

  async ngOnDestroy(): Promise<void> {
    await this.closeModal();
  }

  async closeModal(): Promise<void> {
    if (this.session) {
      // Clean up session state
      this.session.notifyConfirmCreateCredential(false);
      this.session.confirmChosenCipher(null);

      // The session knows whether this ceremony showed any UI, so let it decide
      // whether the window needs to be reset and navigated away from.
      await this.session.hideUi();
    } else {
      // There is no session to hand this off to, so reset the window here.
      await this.desktopSettingsService.setModalMode(false);
      await this.accountService.setShowHeader(true);
      await this.router.navigate(["/"]);
    }
  }
}
