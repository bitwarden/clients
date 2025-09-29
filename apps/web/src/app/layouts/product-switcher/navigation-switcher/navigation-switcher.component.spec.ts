import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconButtonModule, NavigationModule } from "@bitwarden/components";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { NavItemComponent } from "@bitwarden/components/src/navigation/nav-item.component";

import { ProductSwitcherItem, ProductSwitcherService } from "../shared/product-switcher.service";

import { NavigationProductSwitcherComponent } from "./navigation-switcher.component";

@Component({
  selector: "app-upgrade-nav-button",
  template: "<div>Upgrade Nav Button</div>",
  standalone: true,
})
class MockUpgradeNavButtonComponent {}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe("NavigationProductSwitcherComponent", () => {
  let fixture: ComponentFixture<NavigationProductSwitcherComponent>;
  let productSwitcherService: MockProxy<ProductSwitcherService>;

  const mockProducts$ = new BehaviorSubject<{
    bento: ProductSwitcherItem[];
    other: ProductSwitcherItem[];
  }>({
    bento: [],
    other: [],
  });

  const mockShouldShowPremiumUpgradeButton$ = new BehaviorSubject<boolean>(false);

  beforeEach(async () => {
    productSwitcherService = mock<ProductSwitcherService>();
    productSwitcherService.products$ = mockProducts$;
    productSwitcherService.shouldShowPremiumUpgradeButton$ = mockShouldShowPremiumUpgradeButton$;
    mockProducts$.next({ bento: [], other: [] });

    await TestBed.configureTestingModule({
      imports: [RouterModule, NavigationModule, IconButtonModule, MockUpgradeNavButtonComponent],
      declarations: [NavigationProductSwitcherComponent, I18nPipe],
      providers: [
        { provide: ProductSwitcherService, useValue: productSwitcherService },
        {
          provide: I18nService,
          useValue: mock<I18nService>(),
        },
        {
          provide: ActivatedRoute,
          useValue: mock<ActivatedRoute>(),
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NavigationProductSwitcherComponent);
    fixture.detectChanges();
  });

  describe("other products", () => {
    it("links to `marketingRoute`", () => {
      mockProducts$.next({
        bento: [],
        other: [
          {
            isActive: false,
            name: "Other Product",
            icon: "bwi-lock",
            marketingRoute: {
              route: "https://www.example.com/",
              external: true,
            },
          },
        ],
      });

      fixture.detectChanges();

      const link = fixture.nativeElement.querySelector("a");

      expect(link.getAttribute("href")).toBe("https://www.example.com/");
    });

    it("uses `otherProductOverrides` when available", () => {
      mockProducts$.next({
        bento: [],
        other: [
          {
            isActive: false,
            name: "Other Product",
            icon: "bwi-lock",
            marketingRoute: {
              route: "https://www.example.com/",
              external: true,
            },
            otherProductOverrides: { name: "Alternate name" },
          },
        ],
      });

      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("a").textContent.trim()).toBe("Alternate name");

      mockProducts$.next({
        bento: [],
        other: [
          {
            isActive: false,
            name: "Other Product",
            icon: "bwi-lock",
            marketingRoute: {
              route: "https://www.example.com/",
              external: true,
            },
            otherProductOverrides: { name: "Alternate name", supportingText: "Supporting Text" },
          },
        ],
      });

      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("a").textContent.trim().replace(/\s+/g, " ")).toBe(
        "Alternate name Supporting Text",
      );
    });

    it("shows Organizations first in the other products list", () => {
      mockProducts$.next({
        bento: [],
        other: [
          {
            name: "AA Product",
            icon: "bwi-lock",
            marketingRoute: {
              route: "https://www.example.com/",
              external: true,
            },
          },
          {
            name: "Test Product",
            icon: "bwi-lock",
            marketingRoute: {
              route: "https://www.example.com/",
              external: true,
            },
          },
          {
            name: "Organizations",
            icon: "bwi-lock",
            marketingRoute: { route: "https://www.example.com/", external: true },
          },
        ],
      });

      fixture.detectChanges();

      const links = fixture.nativeElement.querySelectorAll("a");

      expect(links.length).toBe(3);

      expect(links[0].textContent).toContain("Organizations");
      expect(links[1].textContent).toContain("AA Product");
      expect(links[2].textContent).toContain("Test Product");
    });

    it('shows the nav item as active when "isActive" is true', () => {
      mockProducts$.next({
        bento: [
          {
            name: "Organizations",
            icon: "bwi-lock",
            marketingRoute: {
              route: "https://www.example.com/",
              external: true,
            },
            isActive: true,
          },
        ],
        other: [],
      });

      fixture.detectChanges();

      const navItem = fixture.debugElement.query(By.directive(NavItemComponent));

      expect(navItem.componentInstance.forceActiveStyles()).toBe(true);
    });
  });

  describe("available products", () => {
    it("shows all products", () => {
      mockProducts$.next({
        bento: [
          { isActive: true, name: "Password Manager", icon: "bwi-lock", appRoute: "/vault" },
          { isActive: false, name: "Secret Manager", icon: "bwi-lock", appRoute: "/sm" },
        ],
        other: [],
      });

      fixture.detectChanges();

      const links = fixture.nativeElement.querySelectorAll("a");

      expect(links.length).toBe(2);

      expect(links[0].textContent).toContain("Password Manager");
      expect(links[1].textContent).toContain("Secret Manager");
    });
  });

  it("links to `appRoute`", () => {
    mockProducts$.next({
      bento: [{ isActive: false, name: "Password Manager", icon: "bwi-lock", appRoute: "/vault" }],
      other: [],
    });

    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector("a");

    expect(link.getAttribute("href")).toBe("/vault");
  });

  describe("upgrade nav button", () => {
    it("shows upgrade nav button when shouldShowPremiumUpgradeButton$ is true", () => {
      mockShouldShowPremiumUpgradeButton$.next(true);
      mockProducts$.next({
        bento: [],
        other: [
          {
            name: "Organizations",
            icon: "bwi-lock",
            marketingRoute: { route: "https://www.example.com/", external: true },
          },
        ],
      });

      fixture.detectChanges();

      const upgradeButton = fixture.nativeElement.querySelector("app-upgrade-nav-button");
      const moreProductsSection = fixture.nativeElement.querySelector("section");

      expect(upgradeButton).toBeTruthy();
      expect(moreProductsSection).toBeFalsy();
    });

    it("shows more products when shouldShowPremiumUpgradeButton$ is false and there are more products", () => {
      mockShouldShowPremiumUpgradeButton$.next(false);
      mockProducts$.next({
        bento: [],
        other: [
          {
            name: "Organizations",
            icon: "bwi-lock",
            marketingRoute: { route: "https://www.example.com/", external: true },
          },
        ],
      });

      fixture.detectChanges();

      const upgradeButton = fixture.nativeElement.querySelector("app-upgrade-nav-button");
      const moreProductsSection = fixture.nativeElement.querySelector("section");

      expect(upgradeButton).toBeFalsy();
      expect(moreProductsSection).toBeTruthy();
    });
  });
});
