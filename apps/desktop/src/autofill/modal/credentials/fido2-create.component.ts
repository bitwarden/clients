import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject } from "@angular/core";
import { RouterModule, Router } from "@angular/router";
import { catchError, from, Observable, of } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { BitwardenShield, NoResults } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DialogService,
  BadgeModule,
  ButtonModule,
  DialogModule,
  SvgModule,
  ItemModule,
  SectionComponent,
  TableModule,
  SectionHeaderComponent,
  BitIconButtonComponent,
  SimpleDialogOptions,
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
    SvgModule,
    ButtonModule,
    DialogModule,
    SectionComponent,
    ItemModule,
    BadgeModule,
    IconComponent,
  ],
  templateUrl: "fido2-create.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fido2CreateComponent implements OnInit, OnDestroy {
  private readonly desktopSettingsService = inject(DesktopSettingsService);
  private readonly fido2UserInterfaceService = inject(DesktopFido2UserInterfaceService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);

  readonly session = this.fido2UserInterfaceService.getCurrentSession();
  readonly ciphers$: Observable<CipherView[] | null> = this.buildCiphers$();
  readonly Icons = { BitwardenShield, NoResults };

  private get DIALOG_MESSAGES() {
    return {
      unexpectedErrorShort: {
        title: { key: "unexpectedErrorShort" },
        content: { key: "closeThisBitwardenWindow" },
        type: "danger",
        acceptButtonText: { key: "closeThisWindow" },
        cancelButtonText: null as null,
        acceptAction: async () => this.dialogService.closeAll(),
      },
      unableToSavePasskey: {
        title: { key: "unableToSavePasskey" },
        content: { key: "closeThisBitwardenWindow" },
        type: "danger",
        acceptButtonText: { key: "closeThisWindow" },
        cancelButtonText: null as null,
        acceptAction: async () => this.dialogService.closeAll(),
      },
      overwritePasskey: {
        title: { key: "overwritePasskey" },
        content: { key: "alreadyContainsPasskey" },
        type: "warning",
      },
    } as const satisfies Record<string, SimpleDialogOptions>;
  }

  async ngOnInit(): Promise<void> {
    if (!this.session) {
      await this.showErrorDialog(this.DIALOG_MESSAGES.unableToSavePasskey);
    }
  }

  async ngOnDestroy(): Promise<void> {
    await this.closeModal();
  }

  async addCredentialToCipher(cipher: CipherView): Promise<void> {
    const isConfirmed = await this.validateCipherAccess(cipher);

    try {
      if (!this.session) {
        throw new Error("Missing session");
      }

      this.session.notifyConfirmCreateCredential(isConfirmed, cipher);
    } catch {
      await this.showErrorDialog(this.DIALOG_MESSAGES.unableToSavePasskey);
      return;
    }

    await this.closeModal();
  }

  async confirmPasskey(): Promise<void> {
    try {
      if (!this.session) {
        throw new Error("Missing session");
      }

      this.session.notifyConfirmCreateCredential(true);
    } catch {
      await this.showErrorDialog(this.DIALOG_MESSAGES.unableToSavePasskey);
    }

    await this.closeModal();
  }

  async closeModal(): Promise<void> {
    // Let the session clean up the modal, if present.
    if (this.session) {
      this.session.notifyConfirmCreateCredential(false);
      this.session.confirmChosenCipher(undefined);
    } else {
      await this.desktopSettingsService.setModalMode(false);
      await this.accountService.setShowHeader(true);
      await this.router.navigate(["/"]);
    }
  }

  private buildCiphers$(): Observable<CipherView[] | null> {
    // Emit `null` (loading/unavailable) until the list resolves. The template
    // treats `null` as a distinct state from an empty list so it doesn't flash
    // the wrong branch.
    if (!this.session) {
      return of(null);
    }

    // The session computes the matching logins once and shares them, so this
    // list always agrees with the session's decision to show this picker.
    return from(this.session.getMatchingLogins()).pipe(
      catchError(() =>
        from(
          this.showErrorDialog(this.DIALOG_MESSAGES.unexpectedErrorShort).then(
            () => [] as CipherView[],
          ),
        ),
      ),
    );
  }

  private async validateCipherAccess(cipher: CipherView): Promise<boolean> {
    if (cipher.login.hasFido2Credentials) {
      const overwriteConfirmed = await this.dialogService.openSimpleDialog(
        this.DIALOG_MESSAGES.overwritePasskey,
      );

      if (!overwriteConfirmed) {
        return false;
      }
    }

    return true;
  }

  private async showErrorDialog(config: SimpleDialogOptions): Promise<void> {
    await this.dialogService.openSimpleDialog(config);
    await this.closeModal();
  }
}
