import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { RouterModule, Router } from "@angular/router";
import { BehaviorSubject, firstValueFrom, map, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BitwardenShield } from "@bitwarden/auth/angular";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DialogService,
  BadgeModule,
  ButtonModule,
  DialogModule,
  IconModule,
  ItemModule,
  SectionComponent,
  TableModule,
  SectionHeaderComponent,
  BitIconButtonComponent,
  SimpleDialogOptions,
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { DesktopAutofillService } from "../../../autofill/services/desktop-autofill.service";
import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";
import {
  DesktopFido2UserInterfaceService,
  DesktopFido2UserInterfaceSession,
} from "../../services/desktop-fido2-user-interface.service";

import { Fido2PasskeyExistsIcon } from "./fido2-passkey-exists-icon";

const DIALOG_MESSAGES = {
  unexpectedErrorShort: {
    title: { key: "unexpectedErrorShort" },
    content: { key: "closeThisBitwardenWindow" },
    type: "danger",
    acceptButtonText: { key: "closeBitwarden" },
    cancelButtonText: null,
  },
  unableToSavePasskey: {
    title: { key: "unableToSavePasskey" },
    content: { key: "closeThisBitwardenWindow" },
    type: "danger",
    acceptButtonText: { key: "closeBitwarden" },
    cancelButtonText: null,
  },
  overwritePasskey: {
    title: { key: "overwritePasskey" },
    content: { key: "alreadyContainsPasskey" },
    type: "warning",
  },
} as const satisfies Record<string, SimpleDialogOptions>;

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
  templateUrl: "fido2-create.component.html",
})
export class Fido2CreateComponent implements OnInit, OnDestroy {
  session?: DesktopFido2UserInterfaceSession = null;
  private ciphersSubject = new BehaviorSubject<CipherView[]>([]);
  ciphers$: Observable<CipherView[]> = this.ciphersSubject.asObservable();
  readonly Icons = { BitwardenShield };
  protected fido2PasskeyExistsIcon = Fido2PasskeyExistsIcon;

  constructor(
    private readonly desktopSettingsService: DesktopSettingsService,
    private readonly fido2UserInterfaceService: DesktopFido2UserInterfaceService,
    private readonly accountService: AccountService,
    private readonly cipherService: CipherService,
    private readonly desktopAutofillService: DesktopAutofillService,
    private readonly dialogService: DialogService,
    private readonly domainSettingsService: DomainSettingsService,
    private readonly passwordRepromptService: PasswordRepromptService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.session = this.fido2UserInterfaceService.getCurrentSession();
    if (!this.session) {
      await this.showErrorDialog(DIALOG_MESSAGES.unableToSavePasskey);
      return;
    }

    try {
      const displayedCiphers = await this.getDisplayedCiphers();
      this.ciphersSubject.next(displayedCiphers);
    } catch {
      await this.showErrorDialog(DIALOG_MESSAGES.unexpectedErrorShort);
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
      await this.showErrorDialog(DIALOG_MESSAGES.unableToSavePasskey);
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
      await this.showErrorDialog(DIALOG_MESSAGES.unableToSavePasskey);
    }

    await this.closeModal();
  }

  async closeModal(): Promise<void> {
    await this.router.navigate(["/"]);

    if (this.session) {
      this.session.notifyConfirmCreateCredential(false);
      this.session.confirmChosenCipher(null);
    }
  }

  private async getDisplayedCiphers(): Promise<CipherView[]> {
    const lastRegistrationRequest = this.desktopAutofillService.lastRegistrationRequest;
    const rpid = await this.session?.getRpId();
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    if (!lastRegistrationRequest || !rpid || !activeUserId) {
      return [];
    }

    const equivalentDomains = await firstValueFrom(
      this.domainSettingsService.getUrlEquivalentDomains(rpid),
    );
    const userHandle = Fido2Utils.bufferToString(
      new Uint8Array(lastRegistrationRequest.userHandle),
    );
    return (await this.cipherService.getAllDecrypted(activeUserId)).filter(
      (cipher) =>
        cipher.login?.matchesUri(rpid, equivalentDomains) &&
        Fido2Utils.cipherHasNoOtherPasskeys(cipher, userHandle) &&
        !cipher.deletedDate,
    );
  }

  private async validateCipherAccess(cipher: CipherView): Promise<boolean> {
    if (cipher.login.hasFido2Credentials) {
      const overwriteConfirmed = await this.dialogService.openSimpleDialog(
        DIALOG_MESSAGES.overwritePasskey,
      );

      if (!overwriteConfirmed) {
        return false;
      }
    }

    if (cipher.reprompt) {
      return this.passwordRepromptService.showPasswordPrompt();
    }

    return true;
  }

  private async showErrorDialog(config: SimpleDialogOptions): Promise<void> {
    await this.dialogService.openSimpleDialog(config);
    await this.closeModal();
  }
}
