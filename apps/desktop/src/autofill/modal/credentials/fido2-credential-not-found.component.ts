import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy, inject } from "@angular/core";
import { RouterModule, Router } from "@angular/router";

import { NoResults } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ButtonModule, StatusLockupComponent, SvgComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";
import { DesktopFido2UserInterfaceService } from "../../services/desktop-fido2-user-interface.service";

import { Fido2ModalHeaderComponent } from "./fido2-modal-header.component";
import { Fido2ModalPageComponent } from "./fido2-modal-page.component";

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    I18nPipe,
    StatusLockupComponent,
    SvgComponent,
    ButtonModule,
    Fido2ModalHeaderComponent,
    Fido2ModalPageComponent,
  ],
  templateUrl: "fido2-credential-not-found.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fido2CredentialNotFoundComponent implements OnDestroy {
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
      // Let the session clean up the modal.
      this.session.notifyCredentialNotFoundDismissed();
    } else {
      // There is no session to hand this off to, so reset the window here.
      await this.desktopSettingsService.setModalMode(false);
      await this.accountService.setShowHeader(true);
      await this.router.navigate(["/"]);
    }
  }
}
