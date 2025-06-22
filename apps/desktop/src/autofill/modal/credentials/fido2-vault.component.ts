import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { RouterModule, Router } from "@angular/router";
import { firstValueFrom, map, BehaviorSubject, Observable, Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BitwardenShield } from "@bitwarden/auth/angular";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeModule,
  ButtonModule,
  DialogModule,
  DialogService,
  IconModule,
  ItemModule,
  SectionComponent,
  TableModule,
  BitIconButtonComponent,
  SectionHeaderComponent,
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

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
  templateUrl: "fido2-vault.component.html",
})
export class Fido2VaultComponent implements OnInit, OnDestroy {
  session?: DesktopFido2UserInterfaceSession = null;
  private destroy$ = new Subject<void>();
  private ciphersSubject = new BehaviorSubject<CipherView[]>([]);
  ciphers$: Observable<CipherView[]> = this.ciphersSubject.asObservable();
  cipherIds$: Observable<string[]> | undefined;
  readonly Icons = { BitwardenShield };

  constructor(
    private readonly desktopSettingsService: DesktopSettingsService,
    private readonly fido2UserInterfaceService: DesktopFido2UserInterfaceService,
    private readonly cipherService: CipherService,
    private readonly accountService: AccountService,
    private readonly dialogService: DialogService,
    private readonly logService: LogService,
    private readonly passwordRepromptService: PasswordRepromptService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.session = this.fido2UserInterfaceService.getCurrentSession();
    this.cipherIds$ = this.session.availableCipherIds$;
    await this.loadCiphers();
  }

  async ngOnDestroy(): Promise<void> {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async chooseCipher(cipher: CipherView): Promise<void> {
    if (!this.session) {
      await this.dialogService.openSimpleDialog({
        title: { key: "unexpectedErrorShort" },
        content: { key: "closeThisBitwardenWindow" },
        type: "danger",
        acceptButtonText: { key: "closeBitwarden" },
        cancelButtonText: null,
      });
      await this.closeModal();

      return;
    }

    const isConfirmed = await this.validateCipherAccess(cipher);
    this.session.confirmChosenCipher(cipher.id, isConfirmed);

    await this.closeModal();
  }

  async closeModal(): Promise<void> {
    if (this.session) {
      this.session.notifyConfirmCreateCredential(false);
      this.session.confirmChosenCipher(null);
    }

    await this.router.navigate(["/"]);
  }

  private async loadCiphers(): Promise<void> {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    if (!activeUserId) {
      return;
    }

    this.cipherIds$.pipe(takeUntil(this.destroy$)).subscribe((cipherIds) => {
      this.cipherService
        .getAllDecryptedForIds(activeUserId, cipherIds || [])
        .then((ciphers) => {
          this.ciphersSubject.next(ciphers.filter((cipher) => !cipher.deletedDate));
        })
        .catch((error) => {
          this.logService.error("Failed to load ciphers", error);
        });
    });

    await this.closeModal();
  }

  private async validateCipherAccess(cipher: CipherView): Promise<boolean> {
    if (cipher.reprompt !== CipherRepromptType.None) {
      return this.passwordRepromptService.showPasswordPrompt();
    }

    return true;
  }
}
