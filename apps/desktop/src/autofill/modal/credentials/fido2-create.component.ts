import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject } from "@angular/core";
import { RouterModule, Router } from "@angular/router";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { BitwardenShield, NoResults } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
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
  private readonly cipherService = inject(CipherService);
  private readonly dialogService = inject(DialogService);
  private readonly domainSettingsService = inject(DomainSettingsService);
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
    const rpid = this.session?.rpId;
    const userHandleBytes = this.session?.userHandle;

    // Emit `null` (loading/unavailable) until we have everything needed to
    // resolve matching ciphers. The template treats `null` as a distinct state
    // from an empty list so it doesn't flash the wrong branch.
    if (!this.session || !rpid || !userHandleBytes) {
      return of(null);
    }

    const userHandle = Fido2Utils.arrayToString(new Uint8Array(userHandleBytes));

    return combineLatest([
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      this.domainSettingsService.getUrlEquivalentDomains(rpid),
    ]).pipe(
      switchMap(async ([activeUserId, equivalentDomains]) => {
        if (!activeUserId) {
          return [];
        }

        try {
          const allCiphers = await this.cipherService.getAllDecrypted(activeUserId);
          return allCiphers.filter(
            (cipher) =>
              cipher != null &&
              cipher.type == CipherType.Login &&
              cipher.login?.matchesUri(rpid, equivalentDomains) &&
              Fido2Utils.cipherHasNoOtherPasskeys(cipher, userHandle) &&
              !cipher.deletedDate,
          );
        } catch {
          await this.showErrorDialog(this.DIALOG_MESSAGES.unexpectedErrorShort);
          return [];
        }
      }),
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
