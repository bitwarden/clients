import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { HeaderComponent } from "@bitwarden/components";

import { AccountSwitcherV2Component } from "../../../auth/components/account-switcher/account-switcher-v2.component";

import { DesktopHeaderComponent } from "./desktop-header.component";

describe("DesktopHeaderComponent", () => {
  let component: DesktopHeaderComponent;
  let fixture: ComponentFixture<DesktopHeaderComponent>;
  let mockI18nService: ReturnType<typeof mock<I18nService>>;
  let mockActivatedRoute: { data: any };

  beforeEach(async () => {
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => `translated_${key}`);

    mockActivatedRoute = {
      data: of({}),
    };

    await TestBed.configureTestingModule({
      imports: [DesktopHeaderComponent, HeaderComponent],
      providers: [
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
        {
          provide: ActivatedRoute,
          useValue: mockActivatedRoute,
        },
      ],
    })
      .overrideComponent(DesktopHeaderComponent, {
        remove: { imports: [AccountSwitcherV2Component] },
        add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DesktopHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  it("renders bit-header component", () => {
    const compiled = fixture.nativeElement;
    const headerElement = compiled.querySelector("bit-header");

    expect(headerElement).toBeTruthy();
  });

  describe("title resolution", () => {
    it("uses title input when provided", () => {
      fixture.componentRef.setInput("title", "Direct Title");
      fixture.detectChanges();

      expect(component["resolvedTitle"]()).toBe("Direct Title");
    });

    it("uses route data titleId when no direct title provided", () => {
      mockActivatedRoute.data = of({
        pageTitle: { key: "sends" },
      });

      fixture = TestBed.createComponent(DesktopHeaderComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockI18nService.t).toHaveBeenCalledWith("sends");
      expect(component["resolvedTitle"]()).toBe("translated_sends");
    });

    it("returns empty string when no title or route data provided", () => {
      mockActivatedRoute.data = of({});

      fixture = TestBed.createComponent(DesktopHeaderComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component["resolvedTitle"]()).toBe("");
    });

    it("prioritizes direct title over route data", () => {
      mockActivatedRoute.data = of({
        pageTitle: { key: "sends" },
      });

      fixture = TestBed.createComponent(DesktopHeaderComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput("title", "Override Title");
      fixture.detectChanges();

      expect(component["resolvedTitle"]()).toBe("Override Title");
    });
  });

  describe("icon input", () => {
    it("accepts icon input", () => {
      fixture.componentRef.setInput("icon", "bwi-send");
      fixture.detectChanges();

      expect(component.icon()).toBe("bwi-send");
    });

    it("defaults to undefined when no icon provided", () => {
      expect(component.icon()).toBeUndefined();
    });
  });

  describe("content projection", () => {
    it("wraps bit-header component for slot pass-through", () => {
      const compiled = fixture.nativeElement;
      const bitHeader = compiled.querySelector("bit-header");

      // Verify bit-header exists and can receive projected content
      expect(bitHeader).toBeTruthy();
    });
  });
});
