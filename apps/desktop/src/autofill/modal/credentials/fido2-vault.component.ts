import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { RouterModule, Router } from "@angular/router";
import {
  firstValueFrom,
  map,
  combineLatest,
  of,
  BehaviorSubject,
  Observable,
  Subject,
  takeUntil,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BitwardenShield } from "@bitwarden/assets/svg";
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

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
    this.cipherIds$ = this.session?.availableCipherIds$;
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
        acceptButtonText: { key: "closeThisWindow" },
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
    await this.desktopSettingsService.setModalMode(false);
    await this.accountService.setShowHeader(true);

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

    // Combine cipher list with optional cipher IDs filter
    combineLatest([this.cipherService.cipherListViews$(activeUserId), this.cipherIds$ || of(null)])
      .pipe(
        map(([ciphers, cipherIds]) => {
          // Filter out deleted ciphers
          const activeCiphers = ciphers.filter((cipher) => !cipher.deletedDate);

          // If specific IDs provided, filter by them
          if (cipherIds?.length > 0) {
            return activeCiphers.filter((cipher) => cipherIds.includes(cipher.id as string));
          }

          return activeCiphers;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (ciphers) => this.ciphersSubject.next(ciphers as CipherView[]),
        error: (error: unknown) => this.logService.error("Failed to load ciphers", error),
      });
  }

  private async validateCipherAccess(cipher: CipherView): Promise<boolean> {
    if (cipher.reprompt !== CipherRepromptType.None) {
      return this.passwordRepromptService.showPasswordPrompt();
    }

    return true;
  }
}
