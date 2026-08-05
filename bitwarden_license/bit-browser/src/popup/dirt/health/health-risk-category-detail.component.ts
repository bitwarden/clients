import { Component, ChangeDetectionStrategy, signal, inject, computed } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs/operators";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { ReportExposedPasswords, NoCredentialsIcon, UnlockedIcon } from "@bitwarden/assets/svg";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  ButtonModule,
  IconButtonModule,
  SvgModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

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
  ],
})
export class HealthRiskCategoryDetailComponent {
  readonly route = inject(ActivatedRoute);

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

  readonly items = signal<CipherView[]>([]);
}
