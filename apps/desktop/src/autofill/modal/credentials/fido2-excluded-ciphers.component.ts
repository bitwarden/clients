import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy } from "@angular/core";
import { RouterModule, Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BitwardenShield, NoResults } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  BadgeModule,
  ButtonModule,
  DialogModule,
  IconModule,
  ItemModule,
  SectionComponent,
  TableModule,
  SectionHeaderComponent,
  BitIconButtonComponent,
} from "@bitwarden/components";

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
    JslibModule,
    IconModule,
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
    // Clean up modal state
    await this.desktopSettingsService.setModalMode(false);
    await this.accountService.setShowHeader(true);

    // Clean up session state
    if (this.session) {
      this.session.notifyConfirmCreateCredential(false);
      this.session.confirmChosenCipher(null);
    }

    // Navigate away
    await this.router.navigate(["/"]);
  }
}
