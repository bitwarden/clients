import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, RouterModule } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { NavigationModule } from "@bitwarden/components";
import { SendListFiltersService } from "@bitwarden/send-ui";

import { SendFiltersNavComponent } from "./send-filters-nav.component";

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
  let sendListFiltersService: MockProxy<SendListFiltersService>;
  let router: MockProxy<Router>;

  beforeEach(async () => {
    sendListFiltersService = mock<SendListFiltersService>();
    sendListFiltersService.filterForm = {
      value: { sendType: null },
      patchValue: jest.fn(),
    } as any;

    router = mock<Router>();
    Object.defineProperty(router, "url", {
      value: "/vault",
      writable: true,
      configurable: true,
    });
    Object.defineProperty(router, "navigate", {
      value: jest.fn().mockResolvedValue(true),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(router, "events", {
      value: new Subject().asObservable(),
      writable: true,
      configurable: true,
    });

    await TestBed.configureTestingModule({
      imports: [SendFiltersNavComponent, NavigationModule, RouterModule.forRoot([])],
      providers: [
        {
          provide: SendListFiltersService,
          useValue: sendListFiltersService,
        },
        {
          provide: Router,
          useValue: router,
        },
        {
          provide: I18nService,
          useValue: mock<I18nService>(),
        },
      ],
    }).compileComponents();

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
    it("returns true when on /new-sends route", () => {
      Object.defineProperty(router, "url", { value: "/new-sends", configurable: true });

      expect(component["isSendRouteActive"]()).toBe(true);
    });

    it("returns false when not on /new-sends route", () => {
      Object.defineProperty(router, "url", { value: "/vault", configurable: true });

      expect(component["isSendRouteActive"]()).toBe(false);
    });
  });

  describe("isTypeActive", () => {
    it("returns true when on send route and filter type matches", () => {
      Object.defineProperty(router, "url", { value: "/new-sends", configurable: true });
      sendListFiltersService.filterForm.value = { sendType: SendType.Text };

      expect(component["isTypeActive"](SendType.Text)).toBe(true);
      expect(component["isTypeActive"](SendType.File)).toBe(false);
    });

    it("returns false when not on send route", () => {
      Object.defineProperty(router, "url", { value: "/vault", configurable: true });
      sendListFiltersService.filterForm.value = { sendType: SendType.Text };

      expect(component["isTypeActive"](SendType.Text)).toBe(false);
    });

    it("returns false when no type is selected", () => {
      Object.defineProperty(router, "url", { value: "/new-sends", configurable: true });
      sendListFiltersService.filterForm.value = { sendType: null };

      expect(component["isTypeActive"](SendType.Text)).toBe(false);
      expect(component["isTypeActive"](SendType.File)).toBe(false);
    });
  });

  describe("selectTypeAndNavigate", () => {
    it("clears the sendType filter when called with no parameter", async () => {
      await component["selectTypeAndNavigate"]();

      expect(sendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: null,
      });
    });

    it("updates filter form with Text type", async () => {
      await component["selectTypeAndNavigate"](SendType.Text);

      expect(sendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: SendType.Text,
      });
    });

    it("updates filter form with File type", async () => {
      await component["selectTypeAndNavigate"](SendType.File);

      expect(sendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: SendType.File,
      });
    });

    it("navigates to /new-sends when not on send route", async () => {
      Object.defineProperty(router, "url", { value: "/vault", configurable: true });

      await component["selectTypeAndNavigate"](SendType.Text);

      expect(router.navigate).toHaveBeenCalledWith(["/new-sends"]);
    });

    it("does not navigate when already on send route", async () => {
      Object.defineProperty(router, "url", { value: "/new-sends", configurable: true });

      await component["selectTypeAndNavigate"](SendType.Text);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("navigates when clearing filter from different route", async () => {
      Object.defineProperty(router, "url", { value: "/vault", configurable: true });

      await component["selectTypeAndNavigate"](); // No parameter = clear filter

      expect(router.navigate).toHaveBeenCalledWith(["/new-sends"]);
    });
  });
});
