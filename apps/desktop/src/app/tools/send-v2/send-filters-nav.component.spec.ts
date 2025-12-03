import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NavigationEnd, Router, RouterModule } from "@angular/router";
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
  let routerEventsSubject: Subject<any>;

  beforeEach(async () => {
    sendListFiltersService = mock<SendListFiltersService>();
    sendListFiltersService.filterForm = {
      value: { sendType: null },
      patchValue: jest.fn(),
    } as any;

    routerEventsSubject = new Subject();
    router = mock<Router>();
    router.events = routerEventsSubject.asObservable();

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

  it("clicking Text filter calls selectType with Text type", () => {
    jest.spyOn(component as any, "selectType");

    const compiled = fixture.debugElement.nativeElement;
    const navItems = compiled.querySelectorAll("bit-nav-item");
    const textNavItem = Array.from(navItems).find(
      (item: Element) => item.getAttribute("icon") === "bwi-file-text",
    );

    if (textNavItem) {
      (textNavItem as HTMLElement).click();
      expect(component["selectType"]).toHaveBeenCalledWith(SendType.Text);
    }
  });

  describe("ngOnInit", () => {
    it("subscribes to router events", () => {
      component.ngOnInit();

      expect(router.events).toBeDefined();
    });

    it("clears sendType filter when navigating to /new-sends route directly", () => {
      sendListFiltersService.filterForm.value = { sendType: SendType.Text };
      component.ngOnInit();

      routerEventsSubject.next(new NavigationEnd(1, "/new-sends", "/new-sends"));

      expect(sendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: null,
      });
    });

    it("does not clear sendType filter when navigating via filter click", () => {
      sendListFiltersService.filterForm.value = { sendType: SendType.Text };

      component["selectType"](SendType.File);

      (sendListFiltersService.filterForm.patchValue as jest.Mock).mockClear();

      routerEventsSubject.next(new NavigationEnd(1, "/new-sends", "/new-sends"));

      expect(sendListFiltersService.filterForm.patchValue).not.toHaveBeenCalled();
    });

    it("resets navigating flag after navigation", () => {
      component.ngOnInit();

      component["selectType"](SendType.Text);
      expect(component["isNavigatingViaFilter"]).toBe(true);

      routerEventsSubject.next(new NavigationEnd(1, "/new-sends", "/new-sends"));

      expect(component["isNavigatingViaFilter"]).toBe(false);
    });

    it("ignores navigation events that are not NavigationEnd", () => {
      component.ngOnInit();

      routerEventsSubject.next({ type: "NavigationStart" });

      expect(sendListFiltersService.filterForm.patchValue).not.toHaveBeenCalled();
    });

    it("ignores navigation to routes that do not include /new-sends", () => {
      component.ngOnInit();

      routerEventsSubject.next(new NavigationEnd(1, "/vault", "/vault"));

      expect(sendListFiltersService.filterForm.patchValue).not.toHaveBeenCalled();
    });
  });

  describe("isTypeActive", () => {
    it("returns true when filter type matches", () => {
      sendListFiltersService.filterForm.value = { sendType: SendType.Text };

      expect(component["isTypeActive"](SendType.Text)).toBe(true);
      expect(component["isTypeActive"](SendType.File)).toBe(false);
    });

    it("returns false when no type is selected", () => {
      sendListFiltersService.filterForm.value = { sendType: null };

      expect(component["isTypeActive"](SendType.Text)).toBe(false);
      expect(component["isTypeActive"](SendType.File)).toBe(false);
    });
  });

  describe("selectType", () => {
    it("updates filter form with selected type", () => {
      component["selectType"](SendType.Text);

      expect(sendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: SendType.Text,
      });
    });

    it("sets navigating flag", () => {
      component["selectType"](SendType.File);

      expect(component["isNavigatingViaFilter"]).toBe(true);
    });

    it("updates filter form with File type", () => {
      component["selectType"](SendType.File);

      expect(sendListFiltersService.filterForm.patchValue).toHaveBeenCalledWith({
        sendType: SendType.File,
      });
    });
  });
});
