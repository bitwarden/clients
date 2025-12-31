import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { NavigationModule } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";

import { DesktopSideNavComponent } from "./desktop-side-nav.component";

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

describe("DesktopSideNavComponent", () => {
  let component: DesktopSideNavComponent;
  let fixture: ComponentFixture<DesktopSideNavComponent>;

  const fakeGlobalStateProvider = new FakeGlobalStateProvider();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesktopSideNavComponent, NavigationModule],
      providers: [
        {
          provide: I18nService,
          useValue: mock<I18nService>(),
        },
        {
          provide: GlobalStateProvider,
          useValue: fakeGlobalStateProvider,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DesktopSideNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  it("renders bit-side-nav component", () => {
    const compiled = fixture.nativeElement;
    const sideNavElement = compiled.querySelector("bit-side-nav");

    expect(sideNavElement).toBeTruthy();
  });

  it("uses primary variant by default", () => {
    expect(component.variant()).toBe("primary");
  });

  it("accepts variant input", () => {
    fixture.componentRef.setInput("variant", "secondary");
    fixture.detectChanges();

    expect(component.variant()).toBe("secondary");
  });

  it.skip("passes variant to bit-side-nav", () => {
    fixture.componentRef.setInput("variant", "secondary");
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const sideNavElement = compiled.querySelector("bit-side-nav");

    expect(sideNavElement.getAttribute("ng-reflect-variant")).toBe("secondary");
  });
});
