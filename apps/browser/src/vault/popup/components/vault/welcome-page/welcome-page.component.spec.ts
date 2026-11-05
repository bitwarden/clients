import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { ToastService } from "@bitwarden/components";

import { consumeDefaultPasswordManagerSuccessToast } from "../../../../../autofill/default-password-manager-session.util";
import { IntroCarouselService } from "../../../services/intro-carousel.service";

import { WelcomePageComponent } from "./welcome-page.component";

jest.mock("../../../../../autofill/default-password-manager-session.util", () => ({
  consumeDefaultPasswordManagerSuccessToast: jest.fn().mockResolvedValue(false),
}));

describe("WelcomePageComponent", () => {
  let component: WelcomePageComponent;
  let fixture: ComponentFixture<WelcomePageComponent>;
  let mockRouter: MockProxy<Router>;
  let mockIntroCarouselService: MockProxy<IntroCarouselService>;
  let mockToastService: MockProxy<ToastService>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    mockRouter = mock<Router>();
    mockIntroCarouselService = mock<IntroCarouselService>();
    mockToastService = mock<ToastService>();
    mockI18nService = mock<I18nService>();

    mockRouter.navigate.mockResolvedValue(true);
    mockIntroCarouselService.setIntroCarouselDismissed.mockResolvedValue();
    jest.mocked(consumeDefaultPasswordManagerSuccessToast).mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [WelcomePageComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: IntroCarouselService, useValue: mockIntroCarouselService },
        { provide: ToastService, useValue: mockToastService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: AbstractThemingService, useValue: { theme$: of(ThemeTypes.Light) } },
      ],
    })
      .overrideComponent(WelcomePageComponent, { set: { template: "" } })
      .compileComponents();

    fixture = TestBed.createComponent(WelcomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("shows the success toast when the default password manager was applied", async () => {
    jest.mocked(consumeDefaultPasswordManagerSuccessToast).mockResolvedValue(true);
    mockI18nService.t.mockReturnValue("Made Bitwarden your default browser password manager");

    await component.ngOnInit();

    expect(mockToastService.showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "Made Bitwarden your default browser password manager",
    });
  });

  it("does not show a toast otherwise", async () => {
    await component.ngOnInit();

    expect(mockToastService.showToast).not.toHaveBeenCalled();
  });

  it("dismisses the intro and navigates to signup", async () => {
    await component["navigateToSignup"]();

    expect(mockIntroCarouselService.setIntroCarouselDismissed).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(["/signup"]);
  });

  it("dismisses the intro and navigates to login", async () => {
    await component["navigateToLogin"]();

    expect(mockIntroCarouselService.setIntroCarouselDismissed).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(["/login"]);
  });
});
