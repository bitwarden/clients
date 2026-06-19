import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { DialogService } from "@bitwarden/components";

import { IntroCarouselService } from "../../../vault/popup/services/intro-carousel.service";
import { AutofillBrowserSettingsService } from "../../services/autofill-browser-settings.service";

import { DefaultPasswordManagerPromptComponent } from "./default-password-manager-prompt.component";
import { DefaultPasswordManagerPromptService } from "./default-password-manager-prompt.service";

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

  it("should dismiss before requesting permission on continue", async () => {
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

    await component["onContinue"]();

    expect(callOrder).toEqual(["dismiss", "disable"]);
    expect(mockRouter.navigate).toHaveBeenCalledWith(["/intro-carousel"]);
  });

  it("should show a dialog when permission is denied on continue", async () => {
    mockAutofillBrowserSettingsService.disableBrowserAutofillAsDefaultPasswordManager.mockResolvedValue(
      "denied",
    );

    await component["onContinue"]();

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
