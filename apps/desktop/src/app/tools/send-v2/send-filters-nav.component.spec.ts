import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { NavigationModule } from "@bitwarden/components";
import { SendListFiltersService } from "@bitwarden/send-ui";
import { GlobalStateProvider } from "@bitwarden/state";

import { SendFiltersNavComponent } from "./send-filters-nav.component";

@Component({ template: "", changeDetection: ChangeDetectionStrategy.OnPush })
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

  const fakeGlobalStateProvider = new FakeGlobalStateProvider();

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
      filters$: filterFormValueSubject.asObservable(),
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
        {
          provide: GlobalStateProvider,
          useValue: fakeGlobalStateProvider,
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
      fixture.detectChanges();

      expect(component["isSendRouteActive"]()).toBe(true);
    });

    it("returns false when not on /new-sends route", () => {
      expect(component["isSendRouteActive"]()).toBe(false);
    });
  });

  describe("activeSendType", () => {
    it("returns the active send type when on send route and filter type is set", async () => {
      await harness.navigateByUrl("/new-sends");
      mockSendListFiltersService.filterForm.value = { sendType: SendType.Text };
      filterFormValueSubject.next({ sendType: SendType.Text });
      fixture.detectChanges();

      expect(component["activeSendType"]()).toBe(SendType.Text);
    });

    it("returns undefined when not on send route", () => {
      mockSendListFiltersService.filterForm.value = { sendType: SendType.Text };
      filterFormValueSubject.next({ sendType: SendType.Text });
      fixture.detectChanges();

      expect(component["activeSendType"]()).toBeUndefined();
    });

    it("returns null when on send route but no type is selected", async () => {
      await harness.navigateByUrl("/new-sends");
      mockSendListFiltersService.filterForm.value = { sendType: null };
      filterFormValueSubject.next({ sendType: null });
      fixture.detectChanges();

      expect(component["activeSendType"]()).toBeNull();
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

    it("does not navigate when already on send route (component is reactive)", async () => {
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
