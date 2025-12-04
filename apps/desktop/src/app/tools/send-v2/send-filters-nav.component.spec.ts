import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { NavigationModule } from "@bitwarden/components";
import { SendListFiltersService } from "@bitwarden/send-ui";

import { SendFiltersNavComponent } from "./send-filters-nav.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ template: "" })
class DummyComponent {}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe("SendFiltersNavComponent", () => {
  let component: SendFiltersNavComponent;
  let fixture: ComponentFixture<SendFiltersNavComponent>;
  let harness: RouterTestingHarness;
  let filterFormValueSubject: BehaviorSubject<{ sendType: SendType | null }>;
  let mockSendListFiltersService: Partial<SendListFiltersService>;

  beforeEach(async () => {
    filterFormValueSubject = new BehaviorSubject<{ sendType: SendType | null }>({
      sendType: null,
    });

    mockSendListFiltersService = {
      filterForm: {
        value: { sendType: null },
        valueChanges: filterFormValueSubject.asObservable(),
        patchValue: jest.fn((value) => {
          mockSendListFiltersService.filterForm.value = {
            ...mockSendListFiltersService.filterForm.value,
            ...value,
          };
          filterFormValueSubject.next(mockSendListFiltersService.filterForm.value);
        }),
      } as any,
    };

    await TestBed.configureTestingModule({
      imports: [SendFiltersNavComponent, NavigationModule],
      providers: [
        provideRouter([
          { path: "vault", component: DummyComponent },
          { path: "new-sends", component: DummyComponent },
        ]),
        {
          provide: SendListFiltersService,
          useValue: mockSendListFiltersService,
        },
        {
          provide: I18nService,
          useValue: {
            t: jest.fn((key) => key),
          },
        },
      ],
    }).compileComponents();

    // Create harness and navigate to initial route
    harness = await RouterTestingHarness.create("/vault");

    // Create the component fixture separately (not a routed component)
    fixture = TestBed.createComponent(SendFiltersNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  it("renders bit-nav-group with Send icon and text", () => {
    const compiled = fixture.nativeElement;
    const navGroup = compiled.querySelector("bit-nav-group");

    expect(navGroup).toBeTruthy();
    expect(navGroup.getAttribute("icon")).toBe("bwi-send");
  });

  it("component exposes SendType enum for template", () => {
    expect(component["SendType"]).toBe(SendType);
  });

  describe("isSendRouteActive", () => {
    it("returns true when on /new-sends route", async () => {
      await harness.navigateByUrl("/new-sends");

      expect(component["isSendRouteActive"]()).toBe(true);
    });

    it("returns false when not on /new-sends route", () => {
      expect(component["isSendRouteActive"]()).toBe(false);
    });
  });

  describe("isTypeActive", () => {
    it("returns true when on send route and filter type matches", async () => {
      await harness.navigateByUrl("/new-sends");
      mockSendListFiltersService.filterForm.value = { sendType: SendType.Text };
      filterFormValueSubject.next({ sendType: SendType.Text });
      fixture.detectChanges();

      expect(component["isTypeActive"](SendType.Text)).toBe(true);
      expect(component["isTypeActive"](SendType.File)).toBe(false);
    });

    it("returns false when not on send route", () => {
      mockSendListFiltersService.filterForm.value = { sendType: SendType.Text };
      filterFormValueSubject.next({ sendType: SendType.Text });
      fixture.detectChanges();

      expect(component["isTypeActive"](SendType.Text)).toBe(false);
    });

    it("returns false when no type is selected", async () => {
      await harness.navigateByUrl("/new-sends");
      mockSendListFiltersService.filterForm.value = { sendType: null };
      filterFormValueSubject.next({ sendType: null });
      fixture.detectChanges();

      expect(component["isTypeActive"](SendType.Text)).toBe(false);
      expect(component["isTypeActive"](SendType.File)).toBe(false);
    });
  });

  describe("selectTypeAndNavigate", () => {
    it("clears the sendType filter when called with no parameter", async () => {
      await component["selectTypeAndNavigate"]();

      expect(mockSendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: null,
      });
    });

    it("updates filter form with Text type", async () => {
      await component["selectTypeAndNavigate"](SendType.Text);

      expect(mockSendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: SendType.Text,
      });
    });

    it("updates filter form with File type", async () => {
      await component["selectTypeAndNavigate"](SendType.File);

      expect(mockSendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: SendType.File,
      });
    });

    it("navigates to /new-sends when not on send route", async () => {
      expect(harness.routeNativeElement?.textContent).toBeDefined();

      await component["selectTypeAndNavigate"](SendType.Text);

      const currentUrl = TestBed.inject(Router).url;
      expect(currentUrl).toBe("/new-sends");
      expect(mockSendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: SendType.Text,
      });
    });

    it("does not navigate when already on send route", async () => {
      await harness.navigateByUrl("/new-sends");
      const router = TestBed.inject(Router);
      const navigateSpy = jest.spyOn(router, "navigate");

      await component["selectTypeAndNavigate"](SendType.Text);

      expect(navigateSpy).not.toHaveBeenCalled();
      expect(mockSendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: SendType.Text,
      });
    });

    it("navigates when clearing filter from different route", async () => {
      await component["selectTypeAndNavigate"](); // No parameter = clear filter

      const currentUrl = TestBed.inject(Router).url;
      expect(currentUrl).toBe("/new-sends");
      expect(mockSendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: null,
      });
    });
  });
});
