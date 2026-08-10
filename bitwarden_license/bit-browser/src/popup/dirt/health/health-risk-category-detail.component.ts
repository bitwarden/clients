import { Component, ChangeDetectionStrategy, inject, computed } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { filter, map, switchMap, take } from "rxjs/operators";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { ReportExposedPasswords, NoCredentialsIcon, UnlockedIcon } from "@bitwarden/assets/svg";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ChangeLoginPasswordService } from "@bitwarden/common/vault/abstractions/change-login-password.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  NoItemsModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  ButtonModule,
  IconButtonModule,
  SvgModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PasswordRepromptService } from "@bitwarden/vault";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-risk-category-detail",
  templateUrl: "./health-risk-category-detail.component.html",
  imports: [
    ItemModule,
    TypographyModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    SectionComponent,
    SectionHeaderComponent,
    ButtonModule,
    IconButtonModule,
    AppVaultIconComponent,
    I18nPipe,
    SvgModule,
    NoItemsModule,
  ],
})
export class HealthRiskCategoryDetailComponent {
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly changeLoginPasswordService = inject(ChangeLoginPasswordService);
  readonly passwordRepromptService = inject(PasswordRepromptService);
  readonly platformUtilsService = inject(PlatformUtilsService);

  readonly category = toSignal(this.route.params.pipe(map((params) => params["category"])));
  readonly contentKeys = computed<{
    titleKey?: string;
    descriptionKey?: string;
    emptyKey?: string;
  }>(() => {
    const keys: { titleKey?: string; descriptionKey?: string; emptyKey?: string } = {};
    switch (this.category()) {
      case "exposed-passwords":
        keys.titleKey = "exposedPasswordsTitle";
        keys.descriptionKey = "exposedPasswordsDescription";
        keys.emptyKey = "exposedPasswordsEmpty";
        break;
      case "weak-passwords":
        keys.titleKey = "weakPasswordsTitle";
        keys.descriptionKey = "weakPasswordsDescription";
        keys.emptyKey = "weakPasswordsEmpty";
        break;
      case "reused-passwords":
        keys.titleKey = "reusedPasswordsTitle";
        keys.descriptionKey = "reusedPasswordsDescription";
        keys.emptyKey = "reusedPasswordsEmpty";
        break;
    }
    return keys;
  });
  readonly emptyIcon = computed(() => {
    switch (this.category()) {
      case "exposed-passwords":
        return ReportExposedPasswords;
      case "weak-passwords":
        return UnlockedIcon;
      case "reused-passwords":
        return NoCredentialsIcon;
    }
  });

  readonly onChangePassword = async (item: CipherView) => {
    const changePasswordUrl = await this.changeLoginPasswordService.getChangePasswordUrl(item);
    if (changePasswordUrl != null) {
      this.platformUtilsService.launchUri(changePasswordUrl);
    }
  };

  readonly onItemClick = async (item: CipherView) => {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(item);
    if (!repromptPassed) {
      return;
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: item.id, type: item.type },
    });
  };

  // TODO: REMOVE - FOR TESTING ONLY
  readonly accountService = inject(AccountService);
  readonly cipherService = inject(CipherService);
  readonly items = toSignal<CipherView[]>(
    this.accountService.activeAccount$.pipe(
      filter((account) => account != null),
      switchMap((account) =>
        this.cipherService.cipherViews$(account.id).pipe(filter((ciphers) => ciphers != null)),
      ),
      take(5),
    ),
  );
}
