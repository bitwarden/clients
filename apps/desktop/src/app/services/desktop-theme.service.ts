import { map } from "rxjs";

import { ThemeType } from "@bitwarden/common/platform/enums";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";
import {
  THEME_SELECTION,
  ThemeStateService,
} from "@bitwarden/common/platform/theming/theme-state.service";

export class DesktopThemeStateService implements ThemeStateService {
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
