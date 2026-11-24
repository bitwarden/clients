import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { Theme } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { POPUP_THEME_STORAGE_KEY } from "../../browser/popup-view";

import { PopupThemeService } from "./popup-theme.service";

describe("PopupThemeService", () => {
  let selectedTheme$: BehaviorSubject<Theme>;
  let setItem: jest.SpyInstance;

  beforeEach(() => {
    selectedTheme$ = new BehaviorSubject<Theme>("system");
    setItem = jest.spyOn(Storage.prototype, "setItem");
    TestBed.configureTestingModule({
      providers: [{ provide: ThemeStateService, useValue: { selectedTheme$ } }],
    });
    TestBed.inject(PopupThemeService).init();
  });

  afterEach(() => {
    setItem.mockRestore();
  });

  it("copies the selected theme, including system, on start and on every change", () => {
    expect(setItem).toHaveBeenCalledWith(POPUP_THEME_STORAGE_KEY, "system");

    selectedTheme$.next("dark");

    expect(setItem).toHaveBeenCalledWith(POPUP_THEME_STORAGE_KEY, "dark");
  });
});
