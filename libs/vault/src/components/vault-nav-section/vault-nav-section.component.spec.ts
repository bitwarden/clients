import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
  const accountService = mock<AccountService>();

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

  /** The `href` the nav item labelled `text` links to. */
  const navItemHref = (root: HTMLElement, text: string) => {
    const item = Array.from(root.querySelectorAll("bit-nav-item")).find((el) =>
      (el as HTMLElement).textContent?.includes(text),
    ) as HTMLElement;
    return item.querySelector("a")?.getAttribute("href");
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    viewModel$.next(personalOnly);

    i18nService.t.mockImplementation((key: string) => key);
    vaultNavService.viewModel$.mockReturnValue(viewModel$);
    accountService.activeAccount$ = of({ id: userId } as Account);

    await TestBed.configureTestingModule({
      imports: [VaultNavSectionComponent, NavigationModule],
      providers: [
        { provide: VaultNavService, useValue: vaultNavService },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: i18nService },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        provideRouter([]),
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

    it("links the lone vault to the unscoped vault, matching it exactly", () => {
      expect(navItemHref(fixture.nativeElement, "My vault")).toBe("/vault");

      const loneVault = fixture.debugElement
        .queryAll(By.css("bit-nav-item"))
        .find((el) => el.componentInstance.text() === "My vault");

      // A subset match would leave it lit on the Trash and Archive routes nested beneath /vault.
      expect(loneVault.componentInstance.routerLinkActiveOptions().paths).toBe("exact");
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

      expect(vaultLabels).toEqual(["Acme corporation", "Smith family"]);
      expect(text).toContain("My vault");
      expect(text.indexOf("My vault")).toBeLessThan(text.indexOf("Acme corporation"));
    });

    it("links My vault to its own route", () => {
      expect(navItemHref(fixture.nativeElement, "My vault")).toBe("/vault/my-vault");
    });

    it("links All items to the unscoped vault, matching it exactly", () => {
      expect(navItemHref(fixture.nativeElement, "allItems")).toBe("/vault");

      const allItems = fixture.debugElement
        .queryAll(By.css("bit-nav-item"))
        .find((el) => el.componentInstance.text() === "allItems");

      // A subset match would leave All items lit alongside whichever vault is scoped.
      expect(allItems.componentInstance.routerLinkActiveOptions().paths).toBe("exact");
    });

    it("links each organization vault to its own route", () => {
      const group = expandGroup("Acme corporation");

      expect(navItemHref(group, "allVaultItems")).toBe("/vault/org-a");
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
