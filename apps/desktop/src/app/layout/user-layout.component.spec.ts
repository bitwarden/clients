import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DesktopLayoutModule } from "./desktop-layout.module";
import { UserLayoutComponent } from "./user-layout.component";

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

describe("UserLayoutComponent", () => {
  let component: UserLayoutComponent;
  let fixture: ComponentFixture<UserLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserLayoutComponent, RouterModule.forRoot([]), DesktopLayoutModule],
      providers: [
        {
          provide: I18nService,
          useValue: mock<I18nService>(),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  it("renders desktop layout", () => {
    const compiled = fixture.nativeElement;
    const layoutElement = compiled.querySelector("app-desktop-layout");

    expect(layoutElement).toBeTruthy();
  });

  it("renders desktop side nav", () => {
    const compiled = fixture.nativeElement;
    const sideNavElement = compiled.querySelector("app-desktop-side-nav");

    expect(sideNavElement).toBeTruthy();
  });

  it("renders logo with correct properties", () => {
    const compiled = fixture.nativeElement;
    const logoElement = compiled.querySelector("bit-nav-logo");

    expect(logoElement).toBeTruthy();
    expect(logoElement.getAttribute("route")).toBe(".");
  });

  it("renders vault navigation item", () => {
    const compiled = fixture.nativeElement;
    const navItems = compiled.querySelectorAll("bit-nav-item");
    const vaultItem = Array.from(navItems).find(
      (item) => (item as Element).getAttribute("icon") === "bwi-vault",
    ) as Element | undefined;

    expect(vaultItem).toBeTruthy();
    expect(vaultItem?.getAttribute("route")).toBe("new-vault");
  });

  it("renders send navigation item", () => {
    const compiled = fixture.nativeElement;
    const navItems = compiled.querySelectorAll("bit-nav-item");
    const sendItem = Array.from(navItems).find(
      (item) => (item as Element).getAttribute("icon") === "bwi-send",
    ) as Element | undefined;

    expect(sendItem).toBeTruthy();
    expect(sendItem?.getAttribute("route")).toBe("new-sends");
  });

  it("renders router outlet", () => {
    const compiled = fixture.nativeElement;
    const routerOutlet = compiled.querySelector("router-outlet");

    expect(routerOutlet).toBeTruthy();
  });

  it("has logo property set", () => {
    expect(component["logo"]).toBeDefined();
  });
});
