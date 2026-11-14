import { concatMap, distinctUntilChanged, map, Observable, Subscription } from "rxjs";

import {
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
  POPUP_STYLE_DISK,
} from "@bitwarden/common/platform/state";

import { BrowserApi } from "../browser/browser-api";

const OPEN_IN_SIDE_PANEL = new KeyDefinition<boolean>(POPUP_STYLE_DISK, "openInSidePanel", {
  deserializer: (s) => s,
});

/** Page loaded in the Chrome Side Panel. Reuses the sidebar UI location of Firefox and Opera. */
export const SIDE_PANEL_PATH = "popup/index.html?uilocation=sidebar";

/**
 * Persists whether the extension opens in the Chrome Side Panel instead of the action popup.
 */
export class SidePanelSettingsService {
  private readonly state: GlobalState<boolean>;

  readonly openInSidePanel$: Observable<boolean>;

  constructor(globalStateProvider: GlobalStateProvider) {
    this.state = globalStateProvider.get(OPEN_IN_SIDE_PANEL);
    this.openInSidePanel$ = this.state.state$.pipe(map((state) => state ?? false));
  }

  async setOpenInSidePanel(openInSidePanel: boolean) {
    await this.state.update(() => openInSidePanel);
  }

  /**
   * Applies the setting to the Chrome Side Panel whenever it changes. Meant to run in the background.
   *
   * When disabled, the side panel is disabled globally so Bitwarden does not appear in Chrome's
   * side panel picker. Features such as autofill triage still enable it per-tab on demand.
   */
  applyToBrowser(): Subscription | undefined {
    if (!BrowserApi.isSidePanelApiSupported) {
      return;
    }

    return this.openInSidePanel$
      .pipe(
        distinctUntilChanged(),
        concatMap(async (openInSidePanel) => {
          await BrowserApi.setSidePanelOptions(
            openInSidePanel ? { path: SIDE_PANEL_PATH, enabled: true } : { enabled: false },
          );
          await BrowserApi.setSidePanelBehavior({ openPanelOnActionClick: openInSidePanel });
        }),
      )
      .subscribe();
  }
}
