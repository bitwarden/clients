import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, Observable } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { BitwardenLogo } from "@bitwarden/assets/svg";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import {
  BaseCardComponent,
  ButtonModule,
  SvgModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import {
  DefaultPasswordBackgroundDark,
  DefaultPasswordBackgroundLight,
  DefaultPasswordIconDark,
  DefaultPasswordIconLight,
} from "./default-password-manager-illustrations";

@Component({
  selector: "autofill-default-password-manager-prompt",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  templateUrl: "./default-password-manager-prompt.component.html",

  imports: [
    BaseCardComponent,
    ButtonModule,
    I18nPipe,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    SvgModule,
    TypographyModule,
  ],
})
export class DefaultPasswordManagerPromptComponent {
  private readonly themeStateService = inject(ThemeStateService);
  private readonly systemTheme$: Observable<Theme> = inject(SYSTEM_THEME_OBSERVABLE);

  private readonly isDarkTheme = toSignal(
    combineLatest([this.themeStateService.selectedTheme$, this.systemTheme$]).pipe(
      map(([theme, systemTheme]) => {
        const effectiveTheme = theme === ThemeTypes.System ? systemTheme : theme;
        return effectiveTheme === ThemeTypes.Dark;
      }),
    ),
    { initialValue: false },
  );

  protected readonly logo = BitwardenLogo;
  protected readonly backgroundIllustration = computed(() =>
    this.isDarkTheme() ? DefaultPasswordBackgroundDark : DefaultPasswordBackgroundLight,
  );
  protected readonly iconIllustration = computed(() =>
    this.isDarkTheme() ? DefaultPasswordIconDark : DefaultPasswordIconLight,
  );
}
