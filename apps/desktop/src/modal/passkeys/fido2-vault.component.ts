import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { RouterModule, Router } from "@angular/router";
import { firstValueFrom, map, BehaviorSubject, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BitwardenShield } from "@bitwarden/auth/angular";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeModule,
  ButtonModule,
  DialogModule,
  IconModule,
  ItemModule,
  SectionComponent,
  TableModule,
  BitIconButtonComponent,
  SectionHeaderComponent,
} from "@bitwarden/components";

import {
  DesktopFido2UserInterfaceService,
  DesktopFido2UserInterfaceSession,
} from "../../autofill/services/desktop-fido2-user-interface.service";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

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
  private ciphersSubject = new BehaviorSubject<CipherView[]>([]);
  ciphers$: Observable<CipherView[]> = this.ciphersSubject.asObservable();
  private cipherIdsSubject = new BehaviorSubject<string[]>([]);
  cipherIds$: Observable<string[]>;
  readonly Icons = { BitwardenShield };

  constructor(
    private readonly desktopSettingsService: DesktopSettingsService,
    private readonly fido2UserInterfaceService: DesktopFido2UserInterfaceService,
    private readonly cipherService: CipherService,
    private readonly accountService: AccountService,
    private readonly router: Router,
  ) {}

  async ngOnInit() {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    this.session = this.fido2UserInterfaceService.getCurrentSession();
    this.cipherIds$ = this.session?.availableCipherIds$;

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.cipherIds$.subscribe((cipherIds) => {
      this.cipherService
        .getAllDecryptedForIds(activeUserId, cipherIds || [])
        .then((ciphers) => {
          this.ciphersSubject.next(ciphers);
        })
        .catch(() => {
          // console.error(err);
        });
    });
  }

  ngOnDestroy() {
    this.cipherIdsSubject.complete(); // Clean up the BehaviorSubject
  }

  async chooseCipher(cipherId: string) {
    this.session?.confirmChosenCipher(cipherId, true);

    await this.router.navigate(["/"]);
    await this.desktopSettingsService.setModalMode(false);
  }

  async closeModal() {
    await this.router.navigate(["/"]);
    await this.desktopSettingsService.setModalMode(false);

    this.session.notifyConfirmCreateCredential(false);
    this.session.confirmChosenCipher(null);
  }
}
