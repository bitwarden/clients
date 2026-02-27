import { Observable, map } from "rxjs";

import { Theme, ThemeTypes } from "../enums";
import { GlobalStateProvider, KeyDefinition, THEMING_DISK } from "../state";

export abstract class ThemeStateService {
  /**
   * The users selected theme.
   */
  abstract selectedTheme$: Observable<Theme>;

  /**
   * A method for updating the current users configured theme.
   * @param theme The chosen user theme.
   */
  abstract setSelectedTheme(theme: Theme): Promise<void>;
}

export const THEME_SELECTION = new KeyDefinition<Theme>(THEMING_DISK, "selection", {
  deserializer: (s) => s,
});

export class DefaultThemeStateService implements ThemeStateService {
  private readonly selectedThemeState = this.globalStateProvider.get(THEME_SELECTION);

  selectedTheme$ = this.selectedThemeState.state$.pipe(
    map((theme) => {
      // We used to support additional themes. Since these are no longer supported we return null to default to the system theme.
      if (theme != null && !Object.values(ThemeTypes).includes(theme)) {
        return null;
      }

      return theme;
    }),
    map((theme) => theme ?? this.defaultTheme),
  );

  constructor(
    private globalStateProvider: GlobalStateProvider,
    private defaultTheme: Theme = ThemeTypes.System,
  ) {}

  async setSelectedTheme(theme: Theme): Promise<void> {
    await this.selectedThemeState.update(() => theme, {
      shouldUpdate: (currentTheme) => currentTheme !== theme,
    });
  }
}
