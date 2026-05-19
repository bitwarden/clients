import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { ButtonModule, DialogModule, DialogRef, DIALOG_DATA } from "@bitwarden/components";
import { VaultCarouselModule } from "@bitwarden/vault";

import { OnboardingService } from "./services/onboarding.service";
import { WelcomeCarouselDialogComponent } from "./welcome-carousel-dialog.component";

const mockOrganizationId = "test-org-id" as OrganizationId;

const mockDialogRef = {
  close: jest.fn(),
  afterClosed: jest.fn().mockReturnValue(of(undefined)),
  closed: of(undefined),
} as unknown as DialogRef<any, any>;

const mockOnboardingService = {
  setCarouselAcknowledged: jest.fn().mockResolvedValue(undefined),
};

const mockRouter = {
  navigate: jest.fn().mockResolvedValue(true),
};

describe("WelcomeCarouselDialogComponent", () => {
  let component: WelcomeCarouselDialogComponent;
  let fixture: ComponentFixture<WelcomeCarouselDialogComponent>;

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [WelcomeCarouselDialogComponent, VaultCarouselModule, DialogModule, ButtonModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: OnboardingService, useValue: mockOnboardingService },
        { provide: Router, useValue: mockRouter },
        { provide: DIALOG_DATA, useValue: { organizationId: mockOrganizationId } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeCarouselDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("starts on the first slide", () => {
    expect(component["currentSlide"]()).toBe(0);
    expect(component["isFirstSlide"]()).toBe(true);
    expect(component["isLastSlide"]()).toBe(false);
  });

  it("onSlideChange updates the currentSlide signal", () => {
    component["onSlideChange"](2);
    expect(component["currentSlide"]()).toBe(2);
  });

  it("isLastSlide is true when on slide 3 (index 3)", () => {
    component["onSlideChange"](3);
    expect(component["isLastSlide"]()).toBe(true);
    expect(component["isFirstSlide"]()).toBe(false);
  });

  describe("onSkip", () => {
    it("calls setCarouselAcknowledged", async () => {
      await component["onSkip"]();
      expect(mockOnboardingService.setCarouselAcknowledged).toHaveBeenCalledTimes(1);
    });

    it("closes the dialog", async () => {
      await component["onSkip"]();
      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("onImportData", () => {
    it("calls setCarouselAcknowledged", async () => {
      await component["onImportData"]();
      expect(mockOnboardingService.setCarouselAcknowledged).toHaveBeenCalledTimes(1);
    });

    it("navigates to the org import page", async () => {
      await component["onImportData"]();
      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ["/organizations", mockOrganizationId, "settings", "tools", "import"],
        { queryParams: { returnTo: "access-intelligence" } },
      );
    });

    it("closes the dialog", async () => {
      await component["onImportData"]();
      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
    });

    it("closes the dialog before navigating", async () => {
      const callOrder: string[] = [];
      (mockDialogRef.close as jest.Mock).mockImplementation(() => callOrder.push("close"));
      mockRouter.navigate.mockImplementation(async () => {
        callOrder.push("navigate");
        return true;
      });

      await component["onImportData"]();

      expect(callOrder).toEqual(["close", "navigate"]);
    });
  });
});
