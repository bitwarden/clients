import { Observable, combineLatest, map } from "rxjs";

import { LabsSettingsServiceAbstraction } from "../../autofill/services/labs-settings.service";
import { ThemeType } from "../enums";
import { GlobalStateProvider, KeyDefinition, THEMING_DISK } from "../state";

export abstract class ThemeStateService {
  /**
   * The users selected theme.
   */
  abstract selectedTheme$: Observable<ThemeType>;

  /**
   * A method for updating the current users configured theme.
   * @param theme The chosen user theme.
   */
  abstract setSelectedTheme(theme: ThemeType): Promise<void>;
}

export const THEME_SELECTION = new KeyDefinition<ThemeType>(THEMING_DISK, "selection", {
  deserializer: (s) => s,
});

export class DefaultThemeStateService implements ThemeStateService {
  private readonly selectedThemeState = this.globalStateProvider.get(THEME_SELECTION);

  selectedTheme$ = combineLatest([
    this.selectedThemeState.state$,
    this.labsSettingsService.getDesignRefreshEnabled(),
  ]).pipe(
    map(([theme, isExtensionRefresh]) => {
      // The extension refresh should not allow for Nord or SolarizedDark
      // Default the user to their system theme
      if (isExtensionRefresh && [ThemeType.Nord, ThemeType.SolarizedDark].includes(theme)) {
        return ThemeType.System;
      }

      return theme;
    }),
    map((theme) => theme ?? this.defaultTheme),
  );

  constructor(
    private globalStateProvider: GlobalStateProvider,
    private labsSettingsService: LabsSettingsServiceAbstraction,
    private defaultTheme: ThemeType = ThemeType.System,
  ) {}

  async setSelectedTheme(theme: ThemeType): Promise<void> {
    await this.selectedThemeState.update(() => theme, {
      shouldUpdate: (currentTheme) => currentTheme !== theme,
    });
  }
}
