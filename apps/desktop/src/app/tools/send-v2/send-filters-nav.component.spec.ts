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
    router.url = "/vault";
    router.navigate = jest.fn().mockResolvedValue(true);
    router.events = new Subject().asObservable();

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
      router.url = "/new-sends";

      expect(component["isSendRouteActive"]()).toBe(true);
    });

    it("returns false when not on /new-sends route", () => {
      router.url = "/vault";

      expect(component["isSendRouteActive"]()).toBe(false);
    });
  });

  describe("isTypeActive", () => {
    it("returns true when on send route and filter type matches", () => {
      router.url = "/new-sends";
      sendListFiltersService.filterForm.value = { sendType: SendType.Text };

      expect(component["isTypeActive"](SendType.Text)).toBe(true);
      expect(component["isTypeActive"](SendType.File)).toBe(false);
    });

    it("returns false when not on send route", () => {
      router.url = "/vault";
      sendListFiltersService.filterForm.value = { sendType: SendType.Text };

      expect(component["isTypeActive"](SendType.Text)).toBe(false);
    });

    it("returns false when no type is selected", () => {
      router.url = "/new-sends";
      sendListFiltersService.filterForm.value = { sendType: null };

      expect(component["isTypeActive"](SendType.Text)).toBe(false);
      expect(component["isTypeActive"](SendType.File)).toBe(false);
    });
  });

  describe("selectAllAndNavigate", () => {
    it("clears the sendType filter", () => {
      component["selectAllAndNavigate"]();

      expect(sendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: null,
      });
    });

    it("navigates to /new-sends when not on send route", () => {
      router.url = "/vault";

      component["selectAllAndNavigate"]();

      expect(router.navigate).toHaveBeenCalledWith(["/new-sends"]);
    });

    it("does not navigate when already on send route", () => {
      router.url = "/new-sends";

      component["selectAllAndNavigate"]();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe("selectTypeAndNavigate", () => {
    it("updates filter form with selected type", () => {
      component["selectTypeAndNavigate"](SendType.Text);

      expect(sendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: SendType.Text,
      });
    });

    it("updates filter form with File type", () => {
      component["selectTypeAndNavigate"](SendType.File);

      expect(sendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: SendType.File,
      });
    });

    it("navigates to /new-sends when not on send route", () => {
      router.url = "/vault";

      component["selectTypeAndNavigate"](SendType.Text);

      expect(router.navigate).toHaveBeenCalledWith(["/new-sends"]);
    });

    it("does not navigate when already on send route", () => {
      router.url = "/new-sends";

      component["selectTypeAndNavigate"](SendType.Text);

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
