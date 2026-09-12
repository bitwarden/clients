import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy, inject } from "@angular/core";
import { RouterModule, Router } from "@angular/router";

import { NoResults } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  BadgeModule,
  ButtonModule,
  DialogModule,
  ItemModule,
  SectionComponent,
  StatusLockupComponent,
  SvgComponent,
  TableModule,
  SectionHeaderComponent,
  BitIconButtonComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";
import { DesktopFido2UserInterfaceService } from "../../services/desktop-fido2-user-interface.service";

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SectionHeaderComponent,
    BitIconButtonComponent,
    TableModule,
    I18nPipe,
    StatusLockupComponent,
    SvgComponent,
    ButtonModule,
    DialogModule,
    SectionComponent,
    ItemModule,
    BadgeModule,
  ],
  templateUrl: "fido2-excluded-ciphers.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fido2ExcludedCiphersComponent implements OnDestroy {
  private readonly desktopSettingsService = inject(DesktopSettingsService);
  private readonly fido2UserInterfaceService = inject(DesktopFido2UserInterfaceService);
  private readonly accountService = inject(AccountService);
  private readonly router = inject(Router);

  readonly session = this.fido2UserInterfaceService.getCurrentSession();
  readonly Icons = { NoResults };

  async ngOnDestroy(): Promise<void> {
    await this.closeModal();
  }

  async closeModal(): Promise<void> {
    if (this.session) {
      // Clean up session state
      this.session.notifyConfirmCreateCredential(false);
      this.session.confirmChosenCipher(undefined);

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
