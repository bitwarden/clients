import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";
import { NavigationModule, SideNavService } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";

import {
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultsNavViewModel,
} from "../../models/vault-nav-view-model";
import { VaultNavService } from "../../services/vault-nav.service";
import { MY_VAULT } from "../vault-items-table/vault-items-table.component";

import { VaultNavSectionComponent } from "./vault-nav-section.component";

const userId = "user-id" as UserId;

const personalItem: VaultNavItemViewModel = {
  id: userId,
  label: "My vault",
  color: "coral",
  icon: "bwi-user",
  type: VaultNavItemType.Personal,
};

const orgA: VaultNavItemViewModel = {
  id: "org-a",
  label: "Acme corporation",
  color: "purple",
  icon: "bwi-business",
  type: VaultNavItemType.Organization,
};

const family: VaultNavItemViewModel = {
  id: "org-b",
  label: "Smith family",
  color: "teal",
  icon: "bwi-family",
  type: VaultNavItemType.Family,
};

const personalOnly: VaultsNavViewModel = {
  vaults: [personalItem],
  organizationDataOwnership: false,
};

const withOrgs: VaultsNavViewModel = {
  vaults: [personalItem, orgA, family],
  organizationDataOwnership: false,
};

const orgDataOwnership: VaultsNavViewModel = {
  vaults: [{ ...orgA, defaultUserCollectionId: "col-a" as CollectionId }],
  organizationDataOwnership: true,
};

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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

describe("VaultNavSectionComponent", () => {
  let fixture: ComponentFixture<VaultNavSectionComponent>;

  const viewModel$ = new BehaviorSubject<VaultsNavViewModel>(personalOnly);
  const vaultNavService = mock<VaultNavService>();
  const i18nService = mock<I18nService>();
  const router = mock<Router>();

  /** Trimmed first-line text of every rendered nav item, group, and section, in document order. */
  const navText = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll("bit-nav-item, bit-nav-group, bit-nav-section"),
    ).map((el) => {
      const element = el as HTMLElement;
      if (element.tagName.toLowerCase() === "bit-nav-section") {
        return element.querySelector("[id^='bit-nav-section-']")?.textContent?.trim();
      }
      return element.textContent?.trim().split("\n")[0].trim();
    });

  const expandGroup = (label: string) => {
    const group = fixture.debugElement
      .queryAll(By.css("bit-nav-group"))
      .find((el) => el.componentInstance.text() === label);
    group.componentInstance.open.set(true);
    fixture.detectChanges();
    return group.nativeElement as HTMLElement;
  };

  const clickNavItem = (root: HTMLElement, text: string) => {
    const item = Array.from(root.querySelectorAll("bit-nav-item")).find((el) =>
      (el as HTMLElement).textContent?.includes(text),
    ) as HTMLElement;
    item.querySelector("button, a")?.dispatchEvent(new MouseEvent("click"));
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    viewModel$.next(personalOnly);

    i18nService.t.mockImplementation((key: string) => key);
    Object.defineProperty(vaultNavService, "viewModel$", { value: viewModel$ });

    await TestBed.configureTestingModule({
      imports: [VaultNavSectionComponent, NavigationModule],
      providers: [
        { provide: VaultNavService, useValue: vaultNavService },
        { provide: I18nService, useValue: i18nService },
        { provide: Router, useValue: router },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    }).compileComponents();

    // Nav items only render their text when the side nav is expanded.
    TestBed.inject(SideNavService).open.set(true);

    fixture = TestBed.createComponent(VaultNavSectionComponent);
    fixture.detectChanges();
  });

  describe("a single personal vault", () => {
    it("renders My vault as a plain item with no All items or Vaults header", () => {
      const text = navText();

      expect(text).toContain("My vault");
      expect(text).not.toContain("allItems");
      expect(text).not.toContain("vaults");
    });

    it("routes to the personal vault using the my-vault segment when the lone vault is clicked", () => {
      clickNavItem(fixture.nativeElement, "My vault");

      expect(router.navigate).toHaveBeenCalledWith(["/vault", MY_VAULT]);
    });
  });

  describe("account with organization vaults", () => {
    beforeEach(() => {
      viewModel$.next(withOrgs);
      fixture.detectChanges();
    });

    it("renders All items above a Vaults section listing every vault in order", () => {
      const text = navText();

      expect(text).toContain("allItems");
      expect(text.indexOf("allItems")).toBeLessThan(text.indexOf("vaults"));

      const vaultsSection = fixture.debugElement
        .queryAll(By.css("bit-nav-section"))
        .find((el) => el.componentInstance.label() === "vaults");
      const vaultLabels = vaultsSection
        .queryAll(By.css("bit-nav-group"))
        .map((el) => el.componentInstance.text());

      expect(vaultLabels).toEqual(["My vault", "Acme corporation", "Smith family"]);
    });

    it("routes to the unfiltered vault when All items is clicked", () => {
      clickNavItem(fixture.nativeElement, "allItems");

      expect(router.navigate).toHaveBeenCalledWith(["/vault"]);
    });

    it("routes to the organization vault when its All vault items is clicked", () => {
      const group = expandGroup("Acme corporation");
      clickNavItem(group, "allVaultItems");

      expect(router.navigate).toHaveBeenCalledWith(["/vault", "org-a"]);
    });
  });

  describe("organization data ownership", () => {
    beforeEach(() => {
      viewModel$.next(orgDataOwnership);
      fixture.detectChanges();
    });

    it("renders the org vault with no My items, Vaults header, or personal vault", () => {
      const text = navText();

      expect(text).toContain("Acme corporation");
      expect(text).not.toContain("myItems");
      expect(text).not.toContain("vaults");
      expect(text).not.toContain("My vault");
      expect(text).not.toContain("allItems");
    });
  });
});
