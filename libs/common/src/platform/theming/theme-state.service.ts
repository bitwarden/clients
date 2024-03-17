import { Observable, map } from "rxjs";

import { ThemeType } from "../enums";
import { GlobalStateProvider, KeyDefinition, THEMING_DISK } from "../state";

export abstract class ThemeStateService {
  /**
   * The users selected theme.
   */
  selectedTheme$: Observable<ThemeType>;

  /**
   * A method for updating the current users configured theme.
   * @param theme The chosen user theme.
   */
  setSelectedTheme: (theme: ThemeType) => Promise<void>;
}

const THEME_SELECTION = new KeyDefinition<ThemeType>(THEMING_DISK, "selection", {
  deserializer: (s) => s,
});

export class DefaultThemeStateService implements ThemeStateService {
  private readonly selectedThemeState = this.globalStateProvider.get(THEME_SELECTION);

  selectedTheme$ = this.selectedThemeState.state$.pipe(map((theme) => theme ?? this.defaultTheme));

  constructor(
    private globalStateProvider: GlobalStateProvider,
    private defaultTheme: ThemeType = ThemeType.System,
  ) {}

  async setSelectedTheme(theme: ThemeType): Promise<void> {
    await this.selectedThemeState.update(() => theme, {
      shouldUpdate: (currentTheme) => currentTheme !== theme,
    });
  }
}
