import { Observable, map } from "rxjs";

import { StateProvider, UserKeyDefinition, THEMING_DISK } from "@bitwarden/state";

import { Theme, ThemeTypes } from "../enums";

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

export const THEME_USER_SELECTION = new UserKeyDefinition<Theme>(THEMING_DISK, "selection", {
  deserializer: (s) => s,
  clearOn: [],
});

export class DefaultThemeStateService implements ThemeStateService {
  selectedTheme$ = this.stateProvider
    .getUserStateOrDefault$(THEME_USER_SELECTION, { userId: undefined, defaultValue: null })
    .pipe(
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
    private stateProvider: StateProvider,
    private defaultTheme: Theme = ThemeTypes.System,
  ) {}

  async setSelectedTheme(theme: Theme): Promise<void> {
    await this.stateProvider.setUserState(THEME_USER_SELECTION, theme);
  }
}
