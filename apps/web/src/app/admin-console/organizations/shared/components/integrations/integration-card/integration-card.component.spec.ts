import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { ToastService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { SharedModule } from "@bitwarden/components/src/shared";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrganizationIntegrationService } from "../services/organization-integration.service";

import { IntegrationCardComponent } from "./integration-card.component";

describe("IntegrationCardComponent", () => {
  let component: IntegrationCardComponent;
  let fixture: ComponentFixture<IntegrationCardComponent>;
  const mockI18nService = mock<I18nService>();
  const activatedRoute = mock<ActivatedRoute>();
  const mockIntegrationService = mock<OrganizationIntegrationService>();

  const systemTheme$ = new BehaviorSubject<ThemeType>(ThemeType.Light);
  const usersPreferenceTheme$ = new BehaviorSubject<ThemeType>(ThemeType.Light);

  beforeEach(async () => {
    // reset system theme
    systemTheme$.next(ThemeType.Light);
    activatedRoute.snapshot = {
      paramMap: {
        get: jest.fn().mockReturnValue("test-organization-id"),
      },
    } as any;

    await TestBed.configureTestingModule({
      imports: [IntegrationCardComponent, SharedModule],
      providers: [
        { provide: ThemeStateService, useValue: { selectedTheme$: usersPreferenceTheme$ } },
        { provide: SYSTEM_THEME_OBSERVABLE, useValue: systemTheme$ },
        { provide: I18nPipe, useValue: mock<I18nPipe>() },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: OrganizationIntegrationService, useValue: mockIntegrationService },
        { provide: ToastService, useValue: mock<ToastService>() },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IntegrationCardComponent);
    component = fixture.componentInstance;

    component.name = "Integration Name";
    component.image = "test-image.png";
    component.linkURL = "https://example.com/";

    mockI18nService.t.mockImplementation((key) => key);
    fixture.detectChanges();
  });

  it("assigns link href", () => {
    const link = fixture.nativeElement.querySelector("a");

    expect(link.href).toBe("https://example.com/");
  });

  it("renders card body", () => {
    const name = fixture.nativeElement.querySelector("h3");

    expect(name.textContent).toContain("Integration Name");
  });

  it("assigns external rel attribute", () => {
    component.externalURL = true;
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector("a");

    expect(link.rel).toBe("noopener noreferrer");
  });

  describe("new badge", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-09-01"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("shows when expiration is in the future", () => {
      component.newBadgeExpiration = "2023-09-02";
      expect(component.showNewBadge()).toBe(true);
    });

    it("does not show when expiration is not set", () => {
      expect(component.showNewBadge()).toBe(false);
    });

    it("does not show when expiration is in the past", () => {
      component.newBadgeExpiration = "2023-08-31";
      expect(component.showNewBadge()).toBe(false);
    });

    it("does not show when expiration is today", () => {
      component.newBadgeExpiration = "2023-09-01";
      expect(component.showNewBadge()).toBe(false);
    });

    it("does not show when expiration is invalid", () => {
      component.newBadgeExpiration = "not-a-date";
      expect(component.showNewBadge()).toBe(false);
    });
  });

  describe("imageDarkMode", () => {
    it("ignores theme changes when darkModeImage is not set", () => {
      systemTheme$.next(ThemeType.Dark);
      usersPreferenceTheme$.next(ThemeType.Dark);

      fixture.detectChanges();

      expect(component.imageEle.nativeElement.src).toContain("test-image.png");
    });

    describe("user prefers the system theme", () => {
      beforeEach(() => {
        component.imageDarkMode = "test-image-dark.png";
      });

      it("sets image src to imageDarkMode", () => {
        usersPreferenceTheme$.next(ThemeType.System);
        systemTheme$.next(ThemeType.Dark);

        fixture.detectChanges();

        expect(component.imageEle.nativeElement.src).toContain("test-image-dark.png");
      });

      it("sets image src to light mode image", () => {
        component.imageEle.nativeElement.src = "test-image-dark.png";

        usersPreferenceTheme$.next(ThemeType.System);
        systemTheme$.next(ThemeType.Light);

        fixture.detectChanges();

        expect(component.imageEle.nativeElement.src).toContain("test-image.png");
      });
    });

    describe("user prefers dark mode", () => {
      beforeEach(() => {
        component.imageDarkMode = "test-image-dark.png";
      });

      it("updates image to dark mode", () => {
        systemTheme$.next(ThemeType.Light); // system theme shouldn't matter
        usersPreferenceTheme$.next(ThemeType.Dark);

        fixture.detectChanges();

        expect(component.imageEle.nativeElement.src).toContain("test-image-dark.png");
      });
    });

    describe("user prefers light mode", () => {
      beforeEach(() => {
        component.imageDarkMode = "test-image-dark.png";
      });

      it("updates image to light mode", () => {
        component.imageEle.nativeElement.src = "test-image-dark.png";

        systemTheme$.next(ThemeType.Dark); // system theme shouldn't matter
        usersPreferenceTheme$.next(ThemeType.Light);

        fixture.detectChanges();

        expect(component.imageEle.nativeElement.src).toContain("test-image.png");
      });
    });
  });

  describe("connected badge", () => {
    it("shows connected badge when isConnected is true", () => {
      component.isConnected = true;

      expect(component.showConnectedBadge()).toBe(true);
    });

    it("does not show connected badge when isConnected is false", () => {
      component.isConnected = false;
      fixture.detectChanges();
      const name = fixture.nativeElement.querySelector("h3 > span > span > span");

      expect(name.textContent).toContain("off");
      // when isConnected is true/false, the badge should be shown as on/off
      // when isConnected is undefined, the badge should not be shown
      expect(component.showConnectedBadge()).toBe(true);
    });

    it("does not show connected badge when isConnected is undefined", () => {
      component.isConnected = undefined;
      expect(component.showConnectedBadge()).toBe(false);
    });
  });
});
