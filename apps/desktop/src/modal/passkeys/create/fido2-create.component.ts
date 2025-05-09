import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { RouterModule, Router } from "@angular/router";
import { autofill } from "desktop_native/napi";
import { BehaviorSubject, firstValueFrom, map, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BitwardenShield } from "@bitwarden/auth/angular";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  compareCredentialIds,
  parseCredentialId,
} from "@bitwarden/common/platform/services/fido2/credential-id-utils";
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
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { DesktopAutofillService } from "../../../autofill/services/desktop-autofill.service";
import {
  DesktopFido2UserInterfaceService,
  DesktopFido2UserInterfaceSession,
} from "../../../autofill/services/desktop-fido2-user-interface.service";
import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";
import { Fido2PasskeyExistsIcon } from "../fido2-passkey-exists-icon";

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
  containsExcludedCiphers: boolean = false;
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
    private readonly logService: LogService,
    private readonly passwordRepromptService: PasswordRepromptService,
    private readonly router: Router,
  ) {}

  async ngOnInit() {
    await this.accountService.setShowHeader(false);
    this.session = this.fido2UserInterfaceService.getCurrentSession();
    const lastRegistrationRequest = this.desktopAutofillService.lastRegistrationRequest;
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
        if (lastRegistrationRequest.excludedCredentials.length > 0) {
          const excludedCiphers = ciphers.filter((cipher) => {
            const credentialId = cipher.login.hasFido2Credentials
              ? parseCredentialId(cipher.login.fido2Credentials[0]?.credentialId)
              : new Uint8Array();
            if (this.eligibleFido2Credential(cipher, lastRegistrationRequest)) {
              return true;
            }

            return (
              cipher.login.matchesUri(rpid, equivalentDomains) &&
              compareCredentialIds(
                credentialId,
                new Uint8Array(lastRegistrationRequest.excludedCredentials[0]),
              )
            );
          });

          this.containsExcludedCiphers = excludedCiphers.length > 0;
          this.ciphersSubject.next(excludedCiphers);
        } else {
          const relevantCiphers = ciphers.filter((cipher) => {
            if (this.eligibleFido2Credential(cipher, lastRegistrationRequest)) {
              return true;
            }
          });
          this.ciphersSubject.next(relevantCiphers);
        }
      })
      .catch((error) => this.logService.error(error));
  }

  async ngOnDestroy() {
    await this.accountService.setShowHeader(true);
  }

  /* Check that a credential is a valid Fido2 credential for the URL and not be in the bin. */
  invalidFido2Credential(cipher: CipherView) {
    return !cipher.login || !cipher.login.hasUris || cipher.deletedDate;
  }

  /*
   * Determines whether a cipher contains a FIDO2 credential that is eligible for registration.
   * If the userHandle values are both empty they are not eligible, so ignore them.
   * */
  eligibleFido2Credential(
    cipher: CipherView,
    lastRegistrationRequest: autofill.PasskeyRegistrationRequest,
  ) {
    return (
      cipher.login.fido2Credentials.some((passkey) => {
        const passkeyUserHandle = Fido2Utils.stringToBuffer(passkey.userHandle) || new Uint8Array();
        const lastRegistrationUserHandle = new Uint8Array(lastRegistrationRequest.userHandle);
        if (passkeyUserHandle.length > 0 || lastRegistrationUserHandle.length > 0) {
          compareCredentialIds(passkeyUserHandle, lastRegistrationUserHandle);
        }
      }) && !this.invalidFido2Credential(cipher)
    );
  }

  async addPasskeyToCipher(cipher: CipherView) {
    let isConfirmed = true;

    if (cipher.login.hasFido2Credentials) {
      isConfirmed = await this.dialogService.openSimpleDialog({
        title: { key: "overwritePasskey" },
        content: { key: "alreadyContainsPasskey" },
        type: "warning",
      });
    }

    if (cipher.reprompt) {
      isConfirmed = await this.passwordRepromptService.showPasswordPrompt();
    }

    this.session.notifyConfirmCreateCredential(isConfirmed, cipher);
  }

  async confirmPasskey() {
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
        this.session.notifyConfirmCreateCredential(true);
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
