import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, RouterModule, Router } from "@angular/router";
import { map, combineLatest, of, Observable, switchMap, catchError } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { NoResults } from "@bitwarden/assets/svg";
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
  SectionHeaderComponent,
  StatusLockupComponent,
  SvgComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";
import { DesktopAutofillUiService } from "../../services/desktop-autofill-ui.service";

import { Fido2ModalHeaderComponent } from "./fido2-modal-header.component";

/**
 * Route `data` for the picker. Every credential kind reuses the same component
 * and only differs in what the modal calls itself.
 */
export type AutofillVaultRouteData = {
  /** i18n key for the modal title, e.g. `passkeyLogin2`. */
  titleKey: string;
  /** i18n key for the heading above the list, if the flow has one. */
  headingKey?: string;
};

/**
 * The credential picker shown when an autofill request needs the user to choose
 * an item. Shared by the passkey, password, and one-time-code flows: the session
 * that put it on screen supplies the candidate ciphers, and the route supplies
 * the title.
 */
@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SectionHeaderComponent,
    TableModule,
    I18nPipe,
    StatusLockupComponent,
    SvgComponent,
    ButtonModule,
    DialogModule,
    SectionComponent,
    ItemModule,
    BadgeModule,
    IconComponent,
    TypographyModule,
    Fido2ModalHeaderComponent,
  ],
  templateUrl: "autofill-vault.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutofillVaultComponent {
  private readonly desktopSettingsService = inject(DesktopSettingsService);
  private readonly autofillUiService = inject(DesktopAutofillUiService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly session = this.autofillUiService.getCurrentSession();
  readonly ciphers$: Observable<CipherViewLike[]> = this.buildCiphers$();
  readonly routeData = this.activatedRoute.snapshot.data as AutofillVaultRouteData;
  readonly Icons = { NoResults };
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
      this.session.cancel();
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
