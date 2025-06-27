import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { AnimationControlService } from "@bitwarden/common/platform/abstractions/animation-control.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";

import { PopupCompactModeService } from "../../../platform/popup/layout/popup-compact-mode.service";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { PopupSizeService } from "../../../platform/popup/layout/popup-size.service";
import { VaultPopupCopyButtonsService } from "../services/vault-popup-copy-buttons.service";

import { AppearanceV2Component } from "./appearance-v2.component";

@Component({
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
})
class MockPopupHeaderComponent {
  @Input() pageTitle: string;
  @Input() backAction: () => void;
}

@Component({
  selector: "popup-page",
  template: `<ng-content></ng-content>`,
})
class MockPopupPageComponent {
  @Input() loading: boolean;
}

describe("AppearanceV2Component", () => {
  let component: AppearanceV2Component;
  let fixture: ComponentFixture<AppearanceV2Component>;

  const showFavicons$ = new BehaviorSubject<boolean>(true);
  const enableBadgeCounter$ = new BehaviorSubject<boolean>(true);
  const selectedTheme$ = new BehaviorSubject<ThemeType>(ThemeType.Light);
  const enableRoutingAnimation$ = new BehaviorSubject<boolean>(true);
  const enableCompactMode$ = new BehaviorSubject<boolean>(false);
  const showQuickCopyActions$ = new BehaviorSubject<boolean>(false);
  const clickItemsToAutofillVaultView$ = new BehaviorSubject<boolean>(false);
  const setSelectedTheme = jest.fn().mockResolvedValue(undefined);
  const setShowFavicons = jest.fn().mockResolvedValue(undefined);
  const setEnableBadgeCounter = jest.fn().mockResolvedValue(undefined);
  const setEnableRoutingAnimation = jest.fn().mockResolvedValue(undefined);
  const setEnableCompactMode = jest.fn().mockResolvedValue(undefined);
  const setShowQuickCopyActions = jest.fn().mockResolvedValue(undefined);
  const setClickItemsToAutofillVaultView = jest.fn().mockResolvedValue(undefined);

  const mockWidthService: Partial<PopupSizeService> = {
    width$: new BehaviorSubject("default"),
    setWidth: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    setSelectedTheme.mockClear();
    setShowFavicons.mockClear();
    setEnableBadgeCounter.mockClear();
    setEnableRoutingAnimation.mockClear();

    await TestBed.configureTestingModule({
      imports: [AppearanceV2Component],
      providers: [
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DomainSettingsService, useValue: { showFavicons$, setShowFavicons } },
        { provide: ThemeStateService, useValue: { selectedTheme$, setSelectedTheme } },
        {
          provide: AnimationControlService,
          useValue: { enableRoutingAnimation$, setEnableRoutingAnimation },
        },
        {
          provide: BadgeSettingsServiceAbstraction,
          useValue: { enableBadgeCounter$, setEnableBadgeCounter },
        },
        {
          provide: PopupCompactModeService,
          useValue: { enabled$: enableCompactMode$, setEnabled: setEnableCompactMode },
        },
        {
          provide: VaultPopupCopyButtonsService,
          useValue: {
            showQuickCopyActions$,
            setShowQuickCopyActions,
          } as Partial<VaultPopupCopyButtonsService>,
        },
        {
          provide: PopupSizeService,
          useValue: mockWidthService,
        },
        {
          provide: VaultSettingsService,
          useValue: {
            clickItemsToAutofillVaultView$,
            setClickItemsToAutofillVaultView,
          },
        },
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

  it("populates the form with the user's current settings", async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.appearanceForm.value).toEqual({
      enableAnimations: true,
      enableFavicon: true,
      enableBadgeCounter: true,
      theme: ThemeType.Light,
      enableCompactMode: false,
      showQuickCopyActions: false,
      width: "default",
      clickItemsToAutofillVaultView: false,
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

    it("updates the animation setting", () => {
      component.appearanceForm.controls.enableAnimations.setValue(false);

      expect(setEnableRoutingAnimation).toHaveBeenCalledWith(false);
    });

    it("updates the compact mode setting", () => {
      component.appearanceForm.controls.enableCompactMode.setValue(true);

      expect(setEnableCompactMode).toHaveBeenCalledWith(true);
    });

    it("updates the quick copy actions setting", () => {
      component.appearanceForm.controls.showQuickCopyActions.setValue(true);

      expect(setShowQuickCopyActions).toHaveBeenCalledWith(true);
    });

    it("updates the width setting", () => {
      component.appearanceForm.controls.width.setValue("wide");

      expect(mockWidthService.setWidth).toHaveBeenCalledWith("wide");
    });

    it("updates the click items to autofill vault view setting", () => {
      component.appearanceForm.controls.clickItemsToAutofillVaultView.setValue(true);

      expect(setClickItemsToAutofillVaultView).toHaveBeenCalledWith(true);
    });
  });
});
