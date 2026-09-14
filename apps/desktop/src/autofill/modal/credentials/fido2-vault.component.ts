import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterModule, Router } from "@angular/router";
import { map, combineLatest, of, Observable, switchMap, catchError } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  BadgeModule,
  ButtonModule,
  DialogModule,
  DialogService,
  ItemModule,
  SectionComponent,
  TableModule,
  BitIconButtonComponent,
  SectionHeaderComponent,
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
    ButtonModule,
    DialogModule,
    SectionComponent,
    ItemModule,
    BadgeModule,
    IconComponent,
  ],
  templateUrl: "fido2-vault.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fido2VaultComponent {
  private readonly desktopSettingsService = inject(DesktopSettingsService);
  private readonly fido2UserInterfaceService = inject(DesktopFido2UserInterfaceService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);

  readonly session = this.fido2UserInterfaceService.getCurrentSession();
  readonly ciphers$: Observable<CipherViewLike[]> = this.buildCiphers$();
  protected readonly CipherViewLikeUtils = CipherViewLikeUtils;

  async chooseCipher(cipher: CipherViewLike): Promise<void> {
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

    this.session.confirmChosenCipher(cipher);

    await this.closeModal();
  }

  async closeModal(): Promise<void> {
    if (this.session) {
      this.session.notifyConfirmCreateCredential(false);
      this.session.confirmChosenCipher(undefined);
    } else {
      await this.desktopSettingsService.setModalMode(false);
      await this.accountService.setShowHeader(true);
      await this.router.navigate(["/"]);
    }
  }

  private buildCiphers$(): Observable<CipherViewLike[]> {
    return this.accountService.activeAccount$.pipe(
      map((account) => account?.id),
      switchMap((activeUserId) => {
        if (!activeUserId) {
          return of<CipherViewLike[]>([]);
        }

        // Combine the cipher list with the optional cipher IDs filter the
        // session made available for this ceremony.
        return combineLatest([
          this.cipherService.cipherListViews$(activeUserId),
          this.session?.availableCipherIds$ ?? of(null as string[] | null),
        ]).pipe(
          map(([ciphers, cipherIds]): CipherViewLike[] => {
            const activeCiphers = ciphers.filter((cipher) => !cipher.deletedDate);

            if (cipherIds != null && cipherIds.length > 0) {
              return activeCiphers.filter((cipher) => {
                const id = cipher.id?.toString();
                return id != null && cipherIds.includes(id);
              });
            }

            return activeCiphers;
          }),
        );
      }),
      catchError((error: unknown) => {
        this.logService.error("Failed to load ciphers", error);
        return of<CipherViewLike[]>([]);
      }),
    );
  }
}
