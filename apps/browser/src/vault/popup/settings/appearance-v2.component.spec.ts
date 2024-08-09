import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { AppearanceV2Component } from "./appearance-v2.component";

@Component({
  standalone: true,
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
})
class MockPopupHeaderComponent {
  @Input() pageTitle: string;
  @Input() backAction: () => void;
}

@Component({
  standalone: true,
  selector: "popup-page",
  template: `<ng-content></ng-content>`,
})
class MockPopupPageComponent {}

describe("AppearanceV2Component", () => {
  let component: AppearanceV2Component;
  let fixture: ComponentFixture<AppearanceV2Component>;

  const showFavicons$ = new BehaviorSubject<boolean>(true);
  const enableBadgeCounter$ = new BehaviorSubject<boolean>(true);
  const selectedTheme$ = new BehaviorSubject<ThemeType>(ThemeType.Nord);
  const setSelectedTheme = jest.fn().mockResolvedValue(undefined);
  const setShowFavicons = jest.fn().mockResolvedValue(undefined);
  const setEnableBadgeCounter = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    setSelectedTheme.mockClear();
    setShowFavicons.mockClear();
    setEnableBadgeCounter.mockClear();

    await TestBed.configureTestingModule({
      imports: [AppearanceV2Component],
      providers: [
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DomainSettingsService, useValue: { showFavicons$, setShowFavicons } },
        {
          provide: BadgeSettingsServiceAbstraction,
          useValue: { enableBadgeCounter$, setEnableBadgeCounter },
        },
        { provide: ThemeStateService, useValue: { selectedTheme$, setSelectedTheme } },
      ],
    })
      .overrideComponent(AppearanceV2Component, {
        remove: {
          imports: [PopupHeaderComponent, PopupPageComponent],
        },
        add: {
          imports: [MockPopupHeaderComponent, MockPopupPageComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AppearanceV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("populates the form with the user's current settings", () => {
    expect(component.appearanceForm.value).toEqual({
      enableFavicon: true,
      enableBadgeCounter: true,
      theme: ThemeType.Nord,
    });
  });

  describe("form changes", () => {
    it("updates the users theme", () => {
      component.appearanceForm.controls.theme.setValue(ThemeType.Light);

      expect(setSelectedTheme).toHaveBeenCalledWith(ThemeType.Light);
    });

    it("updates the users favicon setting", () => {
      component.appearanceForm.controls.enableFavicon.setValue(false);

      expect(setShowFavicons).toHaveBeenCalledWith(false);
    });

    it("updates the users badge counter setting", () => {
      component.appearanceForm.controls.enableBadgeCounter.setValue(false);

      expect(setEnableBadgeCounter).toHaveBeenCalledWith(false);
    });
  });
});
