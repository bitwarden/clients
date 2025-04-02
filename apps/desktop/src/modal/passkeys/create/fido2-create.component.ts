import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { RouterModule, Router } from "@angular/router";
import { BehaviorSubject, firstValueFrom, map, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BitwardenShield } from "@bitwarden/auth/angular";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
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
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import {
  DesktopFido2UserInterfaceService,
  DesktopFido2UserInterfaceSession,
} from "../../../autofill/services/desktop-fido2-user-interface.service";
import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";

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

  constructor(
    private readonly desktopSettingsService: DesktopSettingsService,
    private readonly fido2UserInterfaceService: DesktopFido2UserInterfaceService,
    private readonly accountService: AccountService,
    private readonly cipherService: CipherService,
    private readonly dialogService: DialogService,
    private readonly domainSettingsService: DomainSettingsService,
    private readonly logService: LogService,
    private readonly passwordRepromptService: PasswordRepromptService,
    private readonly router: Router,
  ) {}

  async ngOnInit() {
    await this.accountService.setShowHeader(false);
    this.session = this.fido2UserInterfaceService.getCurrentSession();
    const rpid = await this.session.getRpId();
    const equivalentDomains = await firstValueFrom(
      this.domainSettingsService.getUrlEquivalentDomains(rpid),
    );
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    this.cipherService
      .getAllDecrypted(activeUserId)
      .then((ciphers) => {
        const relevantCiphers = ciphers.filter((cipher) => {
          if (!cipher.login || !cipher.login.hasUris) {
            return false;
          }

          return (
            cipher.login.matchesUri(rpid, equivalentDomains) &&
            (!cipher.login.fido2Credentials || cipher.login.fido2Credentials.length === 0)
          );
        });
        this.ciphersSubject.next(relevantCiphers);
      })
      .catch((error) => this.logService.error(error));
  }

  async ngOnDestroy() {
    await this.accountService.setShowHeader(true);
  }

  async addPasskeyToCipher(cipher: CipherView) {
    this.session.notifyConfirmCreateCredential(true, cipher);
  }

  async confirmPasskey() {
    const userVerified = await this.passwordRepromptService.showPasswordPrompt();

    try {
      // Retrieve the current UI session to control the flow
      if (!this.session) {
        const confirmed = await this.dialogService.openSimpleDialog({
          title: { key: "unexpectedErrorShort" },
          content: { key: "closeThisBitwardenWindow" },
          type: "danger",
          acceptButtonText: { key: "closeBitwarden" },
          cancelButtonText: null,
        });
        if (confirmed) {
          await this.closeModal();
        }
      } else {
        this.session.notifyConfirmCreateCredential(userVerified);
      }

      // Not sure this clean up should happen here or in session.
      // The session currently toggles modal on and send us here
      // But if this route is somehow opened outside of session we want to make sure we clean up?
      await this.router.navigate(["/"]);
      await this.desktopSettingsService.setModalMode(false);
    } catch {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "unableToSavePasskey" },
        content: { key: "closeThisBitwardenWindow" },
        type: "danger",
        acceptButtonText: { key: "closeBitwarden" },
        cancelButtonText: null,
      });

      if (confirmed) {
        await this.closeModal();
      }
    }
  }

  async closeModal() {
    await this.router.navigate(["/"]);
    await this.desktopSettingsService.setModalMode(false);
    this.session.notifyConfirmCreateCredential(false);
    this.session.confirmChosenCipher(null);
  }
}
