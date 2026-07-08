import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { DialogService } from "@bitwarden/components";

jest.mock("../../default-password-manager-session.util", () => ({
  applyDefaultPasswordManagerOverride: jest.fn().mockResolvedValue(undefined),
  setDefaultPasswordManagerSessionState: jest.fn().mockResolvedValue(undefined),
}));

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { IntroCarouselService } from "../../../vault/popup/services/intro-carousel.service";
import {
  applyDefaultPasswordManagerOverride,
  setDefaultPasswordManagerSessionState,
} from "../../default-password-manager-session.util";
import { AutofillBrowserSettingsService } from "../../services/autofill-browser-settings.service";

import { DefaultPasswordManagerPromptComponent } from "./default-password-manager-prompt.component";
import { DefaultPasswordManagerPromptService } from "./default-password-manager-prompt.service";

const setDefaultPasswordManagerSessionStateMock =
  setDefaultPasswordManagerSessionState as jest.Mock;
const applyDefaultPasswordManagerOverrideMock = applyDefaultPasswordManagerOverride as jest.Mock;

jest.mock("../../../platform/browser/browser-api", () => ({
  BrowserApi: {
    isFirefox: false,
    getBrowserClientVendor: jest.fn().mockReturnValue("Chrome"),
    permissionsGranted: jest.fn().mockResolvedValue(true),
    requestPermission: jest.fn().mockResolvedValue(true),
    closePopup: jest.fn(),
  },
}));

jest.mock("../../../platform/browser/browser-popup-utils", () => ({
  __esModule: true,
  default: {
    inPopup: jest.fn().mockReturnValue(true),
    inPopout: jest.fn().mockReturnValue(false),
  },
}));

describe("DefaultPasswordManagerPromptComponent", () => {
  let component: DefaultPasswordManagerPromptComponent;
  let fixture: ComponentFixture<DefaultPasswordManagerPromptComponent>;
  let mockRouter: MockProxy<Router>;
  let mockDialogService: MockProxy<DialogService>;
  let mockPromptService: MockProxy<DefaultPasswordManagerPromptService>;
  let mockIntroCarouselService: MockProxy<IntroCarouselService>;
  let mockAutofillBrowserSettingsService: MockProxy<AutofillBrowserSettingsService>;

  beforeEach(async () => {
    mockRouter = mock<Router>();
    mockDialogService = mock<DialogService>();
    mockPromptService = mock<DefaultPasswordManagerPromptService>();
    mockIntroCarouselService = mock<IntroCarouselService>();
    mockAutofillBrowserSettingsService = mock<AutofillBrowserSettingsService>();

    BrowserApi.isFirefox = false;
    jest.mocked(BrowserApi.permissionsGranted).mockResolvedValue(true);
    jest.mocked(BrowserPopupUtils.inPopup).mockReturnValue(true);
    jest.mocked(BrowserPopupUtils.inPopout).mockReturnValue(false);
    setDefaultPasswordManagerSessionStateMock.mockClear();
    applyDefaultPasswordManagerOverrideMock.mockClear();
    jest.mocked(BrowserApi.closePopup).mockClear();
    jest.mocked(BrowserApi.requestPermission).mockResolvedValue(true);

    mockRouter.navigate.mockResolvedValue(true);
    Object.defineProperty(mockRouter, "url", { value: "/" });
    Object.defineProperty(mockRouter, "events", { value: of() });
    mockPromptService.setPromptDismissed.mockResolvedValue(undefined);
    Object.defineProperty(mockIntroCarouselService, "introCarouselState$", { value: of(false) });
    mockAutofillBrowserSettingsService.isDefaultPasswordManagerPromptFlowComplete.mockResolvedValue(
      false,
    );
    mockAutofillBrowserSettingsService.disableBrowserAutofillAsDefaultPasswordManager.mockResolvedValue(
      "applied",
    );
    mockAutofillBrowserSettingsService.completeFirefoxPopupPermissionFlow.mockResolvedValue(
      undefined,
    );
    mockDialogService.openSimpleDialog.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [DefaultPasswordManagerPromptComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: mockRouter },
        { provide: DefaultPasswordManagerPromptService, useValue: mockPromptService },
        { provide: IntroCarouselService, useValue: mockIntroCarouselService },
        { provide: AutofillBrowserSettingsService, useValue: mockAutofillBrowserSettingsService },
        {
          provide: AbstractThemingService,
          useValue: { theme$: of(ThemeTypes.Light) },
        },
      ],
    })
      .overrideComponent(DefaultPasswordManagerPromptComponent, {
        set: { template: "" },
      })
      .overrideProvider(DialogService, { useValue: mockDialogService })
      .compileComponents();

    fixture = TestBed.createComponent(DefaultPasswordManagerPromptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should dismiss before requesting permission on continue in Chromium browsers", async () => {
    const callOrder: string[] = [];
    mockPromptService.setPromptDismissed.mockImplementation(async () => {
      callOrder.push("dismiss");
    });
    mockAutofillBrowserSettingsService.disableBrowserAutofillAsDefaultPasswordManager.mockImplementation(
      async () => {
        callOrder.push("disable");
        return "applied";
      },
    );

    await component["continueWithDefaultPasswordManagerApply"]();

    expect(callOrder).toEqual(["dismiss", "disable"]);
    expect(mockRouter.navigate).toHaveBeenCalledWith(["/intro-carousel"]);
  });

  it("should request permission before pending state on Firefox popup continue", () => {
    BrowserApi.isFirefox = true;
    component["privacyPermissionIsGranted"].set(false);
    jest.mocked(BrowserPopupUtils.inPopout).mockReturnValue(false);

    const callOrder: string[] = [];
    mockAutofillBrowserSettingsService.requestPrivacyPermissionFromUserGesture.mockImplementation(
      () => {
        callOrder.push("request");
      },
    );

    component["onContinueClick"]();

    expect(callOrder).toEqual(["request"]);
    expect(BrowserApi.requestPermission).not.toHaveBeenCalled();
  });

  it("should apply and navigate on Firefox popout continue when permission is granted", async () => {
    BrowserApi.isFirefox = true;
    component["privacyPermissionIsGranted"].set(false);
    jest.mocked(BrowserPopupUtils.inPopout).mockReturnValue(true);
    jest.mocked(BrowserApi.requestPermission).mockResolvedValue(true);

    await component["continueFirefoxPopout"]();

    expect(BrowserApi.requestPermission).toHaveBeenCalledWith({ permissions: ["privacy"] });
    expect(applyDefaultPasswordManagerOverrideMock).toHaveBeenCalled();
    expect(setDefaultPasswordManagerSessionStateMock).not.toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(["/intro-carousel"]);
  });

  it("should show a dialog and navigate on Firefox popout continue when permission is denied", async () => {
    BrowserApi.isFirefox = true;
    component["privacyPermissionIsGranted"].set(false);
    jest.mocked(BrowserPopupUtils.inPopout).mockReturnValue(true);
    jest.mocked(BrowserApi.requestPermission).mockResolvedValue(false);

    await component["continueFirefoxPopout"]();

    expect(mockDialogService.openSimpleDialog).toHaveBeenCalled();
    expect(applyDefaultPasswordManagerOverrideMock).not.toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(["/intro-carousel"]);
  });

  it("should close the toolbar popup but not a popout on Firefox popup continue", async () => {
    BrowserApi.isFirefox = true;
    component["privacyPermissionIsGranted"].set(false);
    jest.mocked(BrowserPopupUtils.inPopup).mockReturnValue(false);
    jest.mocked(BrowserPopupUtils.inPopout).mockReturnValue(true);

    await component["continueFirefoxPopup"]();

    expect(
      mockAutofillBrowserSettingsService.completeFirefoxPopupPermissionFlow,
    ).toHaveBeenCalledWith(window);
    expect(mockPromptService.setPromptDismissed).toHaveBeenCalled();
  });

  it("should close the toolbar popup on Firefox popup continue", async () => {
    BrowserApi.isFirefox = true;
    component["privacyPermissionIsGranted"].set(false);
    jest.mocked(BrowserPopupUtils.inPopup).mockReturnValue(true);
    jest.mocked(BrowserPopupUtils.inPopout).mockReturnValue(false);

    await component["continueFirefoxPopup"]();

    expect(
      mockAutofillBrowserSettingsService.completeFirefoxPopupPermissionFlow,
    ).toHaveBeenCalledWith(window);
    expect(mockPromptService.setPromptDismissed).toHaveBeenCalled();
  });

  it("should show a dialog when permission is denied on continue", async () => {
    mockAutofillBrowserSettingsService.disableBrowserAutofillAsDefaultPasswordManager.mockResolvedValue(
      "denied",
    );

    await component["continueWithDefaultPasswordManagerApply"]();

    expect(mockDialogService.openSimpleDialog).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(["/intro-carousel"]);
  });

  it("should dismiss and navigate on skip", async () => {
    await component["onSkip"]();

    expect(mockPromptService.setPromptDismissed).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(["/intro-carousel"]);
  });

  it("should advance when the apply flow completed while the popup was closed", async () => {
    mockAutofillBrowserSettingsService.isDefaultPasswordManagerPromptFlowComplete.mockResolvedValue(
      true,
    );

    await component.ngOnInit();

    expect(mockPromptService.setPromptDismissed).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(["/intro-carousel"]);
  });
});
