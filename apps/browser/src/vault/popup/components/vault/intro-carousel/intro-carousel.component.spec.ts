import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { IntroCarouselComponent } from "@bitwarden/browser/vault/popup/components/vault/intro-carousel/intro-carousel.component";
import { IntroCarouselService } from "@bitwarden/browser/vault/popup/services/intro-carousel.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

describe("IntroCarouselComponent", () => {
  let component: IntroCarouselComponent;
  let fixture: ComponentFixture<IntroCarouselComponent>;
  let mockIntroCarouselService: IntroCarouselService;
  let navigateSpy: any;
  let carouselDismissedSpy: any;

  beforeEach(async () => {
    mockIntroCarouselService = mock<IntroCarouselService>();

    await TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: IntroCarouselService, useValue: mockIntroCarouselService },
        { provide: I18nService, useValue: mock<I18nService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IntroCarouselComponent);
    component = fixture.componentInstance;

    navigateSpy = jest.spyOn(component["router"], "navigate").mockResolvedValue(true);
    carouselDismissedSpy = jest
      .spyOn(mockIntroCarouselService, "setIntroCarouselDismissed")
      .mockResolvedValue();
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
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
