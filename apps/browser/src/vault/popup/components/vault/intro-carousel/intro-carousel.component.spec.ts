import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { consumeDefaultPasswordManagerSuccessToast } from "@bitwarden/browser/autofill/default-password-manager-session.util";
import { IntroCarouselComponent } from "@bitwarden/browser/vault/popup/components/vault/intro-carousel/intro-carousel.component";
import { IntroCarouselService } from "@bitwarden/browser/vault/popup/services/intro-carousel.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

jest.mock("@bitwarden/browser/autofill/default-password-manager-session.util", () => ({
  consumeDefaultPasswordManagerSuccessToast: jest.fn().mockResolvedValue(false),
}));

describe("IntroCarouselComponent", () => {
  let component: IntroCarouselComponent;
  let fixture: ComponentFixture<IntroCarouselComponent>;
  let mockRouter: Router;
  let mockIntroCarouselService: IntroCarouselService;
  let mockToastService: ToastService;
  let mockI18nService: I18nService;
  let navigateSpy: jest.SpyInstance;
  let carouselDismissedSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockRouter = mock<Router>();
    mockIntroCarouselService = mock<IntroCarouselService>();
    mockToastService = mock<ToastService>();
    mockI18nService = mock<I18nService>();

    await TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: IntroCarouselService, useValue: mockIntroCarouselService },
        { provide: ToastService, useValue: mockToastService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IntroCarouselComponent);
    component = fixture.componentInstance;

    navigateSpy = jest.spyOn(mockRouter, "navigate").mockResolvedValue(true);
    carouselDismissedSpy = jest
      .spyOn(mockIntroCarouselService, "setIntroCarouselDismissed")
      .mockResolvedValue();
    jest.mocked(consumeDefaultPasswordManagerSuccessToast).mockResolvedValue(false);
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should show success toast when default password manager was applied", async () => {
    jest.mocked(consumeDefaultPasswordManagerSuccessToast).mockResolvedValue(true);
    jest
      .spyOn(mockI18nService, "t")
      .mockReturnValue("Made Bitwarden your default browser password manager");
    await component.ngOnInit();

    expect(mockToastService.showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "Made Bitwarden your default browser password manager",
    });
  });

  describe("navigateToSignup", () => {
    it("should set intro carousel as dismissed and navigate to signup", async () => {
      await component["navigateToSignup"]();

      expect(carouselDismissedSpy).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(["/signup"]);
    });
  });

  describe("navigateToLogin", () => {
    it("should set intro carousel as dismissed and navigate to login", async () => {
      await component["navigateToLogin"]();

      expect(carouselDismissedSpy).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(["/login"]);
    });
  });
});
