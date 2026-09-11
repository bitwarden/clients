import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  ALL_ITEMS_SCOPE,
  VAULT_BASE_ROUTE,
  VaultNavItemType,
  VaultNavService,
  VaultScopeType,
} from "@bitwarden/vault";

import { VaultPopupListTableFiltersService } from "../../../services/vault-popup-list-table-filters.service";
import { VaultPopupScrollPositionService } from "../../../services/vault-popup-scroll-position.service";

import { VaultSwitcherComponent } from "./vault-switcher.component";

describe("VaultSwitcherComponent", () => {
  let fixture: ComponentFixture<VaultSwitcherComponent>;

  /** Only a guid parses as an organization segment — see `parseVaultScope`. */
  const ORG_ID = "11111111-1111-4111-8111-111111111111";

  const nav$ = new BehaviorSubject<any>({ vaults: [], organizationDataOwnership: false });
  const navigate = jest.fn();
  const clearVaultScopedFilters = jest.fn();
  const stopScrollPosition = jest.fn();

  const trigger = () => fixture.debugElement.query(By.css('[data-testid="vault-switcher"]'));

  /** The menu's options, which only exist once the trigger is open. */
  function openMenu() {
    trigger().nativeElement.click();
    fixture.detectChanges();
    return document.querySelectorAll("button[bitmenuitem], [bitMenuItem]");
  }

  beforeEach(async () => {
    navigate.mockClear();
    clearVaultScopedFilters.mockClear();
    stopScrollPosition.mockClear();
    nav$.next({ vaults: [], organizationDataOwnership: false });

    await TestBed.configureTestingModule({
      imports: [VaultSwitcherComponent],
      providers: [
        { provide: VaultNavService, useValue: { viewModel$: () => nav$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: Router, useValue: { navigate } },
        { provide: VAULT_BASE_ROUTE, useValue: "/tabs/vault" },
        {
          provide: VaultPopupListTableFiltersService,
          useValue: { clearVaultScopedFilters },
        },
        {
          provide: VaultPopupScrollPositionService,
          useValue: { stop: stopScrollPosition },
        },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key, translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultSwitcherComponent);
    fixture.componentRef.setInput("scope", ALL_ITEMS_SCOPE);
    fixture.detectChanges();
  });

  /** Gated on `organizations$`, which is empty for a lone vault, rather than re-deriving it. */
  it("renders nothing when there is only one reachable vault", () => {
    expect(trigger()).toBeNull();
  });

  describe("with more than one vault", () => {
    beforeEach(() => {
      nav$.next({
        vaults: [
          {
            id: "user-1",
            type: VaultNavItemType.Personal,
            label: "My vault",
            icon: "bwi-user",
            color: "#175ddc",
          },
          {
            id: ORG_ID,
            type: VaultNavItemType.Organization,
            label: "Acme corporation",
            icon: "bwi-business",
          },
        ],
        organizationDataOwnership: false,
      });
      fixture.detectChanges();
    });

    it("labels the control All items when the page is unscoped", () => {
      expect(fixture.nativeElement.textContent).toContain("allItems");
    });

    /** Labelled from the route-derived scope, so a cache-restored vault shows with no local state. */
    it("labels the trigger from a scope the route resolved", () => {
      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.Organization,
        organizationId: ORG_ID as OrganizationId,
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("Acme corporation");
    });

    /** The chevron carries no text of its own, so it needs an explicit name. */
    it("gives the icon-only trigger an accessible name", () => {
      expect(trigger().nativeElement.getAttribute("aria-label")).toBe("switchVault");
    });

    /** The header drops its own `h1` while this label renders, so this is the page's only one. */
    it("renders the label as the page's h1", () => {
      expect(fixture.debugElement.query(By.css("h1"))).not.toBeNull();
    });

    /** `bitTypography` is a static attribute, so a missing module loses the classes silently. */
    it("styles the label as a heading", () => {
      const label = fixture.debugElement.query(By.css("[bitTypography]")).nativeElement;

      expect(label.classList).toContain("!tw-text-base");
      expect(label.classList).toContain("tw-font-medium");
    });

    /** On a non-focusable wrapper the directive's focus restore and aria bindings are lost. */
    it("carries the menu trigger on the focusable button", () => {
      const button = trigger().nativeElement as HTMLElement;

      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("aria-haspopup")).toBe("menu");
      expect(button.getAttribute("aria-expanded")).toBe("false");
    });

    /** Shared `navIconTile`, so a vault reads the same color as in the web side nav. */
    it("renders a tile on the trigger and on every entry", () => {
      expect(fixture.debugElement.queryAll(By.css("bit-icon-tile")).length).toBe(1);

      openMenu();

      // The trigger's tile, plus All items and the account's two vaults.
      expect(document.querySelectorAll("bit-icon-tile").length).toBe(4);
    });

    /** The checkmark tracks the route-derived scope rather than a selection held here. */
    it("marks the entry the route names", () => {
      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.Organization,
        organizationId: ORG_ID as OrganizationId,
      });
      fixture.detectChanges();
      openMenu();

      const marks = document.querySelectorAll('[data-testid="vault-switcher-check"]');
      const visible = Array.from(marks).filter((m) => !m.classList.contains("tw-invisible"));

      expect(visible.length).toBe(1);
    });

    /**
     * The open style is the button's `aria-expanded:` variants, so the attribute has to track the
     * menu even on the close paths the directive runs outside change detection.
     */
    describe("the trigger's expanded state", () => {
      const expanded = () => trigger().nativeElement.getAttribute("aria-expanded");

      it("is unset while the menu is closed", () => {
        expect(expanded()).toBe("false");
      });

      it("is set while the menu is open", () => {
        openMenu();

        expect(expanded()).toBe("true");
      });

      it("clears once the menu closes", () => {
        openMenu();
        expect(expanded()).toBe("true");

        // The menu emits `closed` however it was dismissed — Escape, backdrop, or a selection.
        fixture.debugElement.query(By.css("bit-menu")).componentInstance.closed.emit();
        fixture.detectChanges();

        expect(expanded()).toBe("false");
      });
    });

    /** Cleared here rather than on the scope publish, which also fires on popup open. */
    describe("vault-scoped chip filters", () => {
      it("clears them when entering an organization's vault", () => {
        const options = openMenu();
        (options[2] as HTMLElement).click();

        expect(clearVaultScopedFilters).toHaveBeenCalled();
      });

      it("clears them when entering the personal vault", () => {
        const options = openMenu();
        (options[1] as HTMLElement).click();

        expect(clearVaultScopedFilters).toHaveBeenCalled();
      });

      /** All items widens, so nothing selected under a vault has stopped existing. */
      it("keeps them when widening to All items", () => {
        const options = openMenu();
        (options[0] as HTMLElement).click();

        expect(clearVaultScopedFilters).not.toHaveBeenCalled();
      });

      /** Nothing is cleared until the user actually picks a vault. */
      it("keeps them while the popup merely opens on a scoped route", () => {
        fixture.componentRef.setInput("scope", {
          type: VaultScopeType.Organization,
          organizationId: ORG_ID as OrganizationId,
        });
        fixture.detectChanges();

        expect(clearVaultScopedFilters).not.toHaveBeenCalled();
      });
    });

    /** The rebuilt page would otherwise restore the previous vault's offset onto a new list. */
    describe("the stored scroll position", () => {
      // Scoped first, so every other entry is a real switch — All items included.
      beforeEach(() => {
        fixture.componentRef.setInput("scope", {
          type: VaultScopeType.Organization,
          organizationId: ORG_ID as OrganizationId,
        });
        fixture.detectChanges();
      });

      it.each([
        ["the personal vault", 1],
        ["All items", 0],
      ])("is discarded when switching to %s", (_label: string, option: number) => {
        const options = openMenu();
        (options[option] as HTMLElement).click();

        expect(stopScrollPosition).toHaveBeenCalledWith(true);
      });
    });

    /** The entry in view is clickable too, and the route reloads rather than no-ops. */
    describe("re-picking the vault already in view", () => {
      beforeEach(() => {
        fixture.componentRef.setInput("scope", {
          type: VaultScopeType.Organization,
          organizationId: ORG_ID as OrganizationId,
        });
        fixture.detectChanges();
      });

      it("changes nothing", () => {
        // [2] is that same organization — the entry carrying the check.
        const options = openMenu();
        (options[2] as HTMLElement).click();

        expect(clearVaultScopedFilters).not.toHaveBeenCalled();
        expect(stopScrollPosition).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
      });

      it("still acts on a different entry", () => {
        const options = openMenu();
        (options[1] as HTMLElement).click();

        expect(clearVaultScopedFilters).toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith(["/tabs/vault", "my-vault"], { replaceUrl: true });
      });
    });

    /** All items is `null`, so re-picking it from the unscoped page is the same no-op. */
    it("changes nothing when re-picking All items while unscoped", () => {
      const options = openMenu();
      (options[0] as HTMLElement).click();

      expect(navigate).not.toHaveBeenCalled();
    });

    it("navigates to the organization's scoped route", () => {
      // [0] All vaults, [1] My vault, [2] the first organization.
      const options = openMenu();
      (options[2] as HTMLElement).click();

      expect(navigate).toHaveBeenCalledWith(["/tabs/vault", ORG_ID], { replaceUrl: true });
    });

    it("navigates to the personal vault's scoped route", () => {
      const options = openMenu();
      (options[1] as HTMLElement).click();

      expect(navigate).toHaveBeenCalledWith(["/tabs/vault", "my-vault"], { replaceUrl: true });
    });

    /** All items is the unscoped route, which applies no vault narrowing. */
    it("navigates to the unscoped route for All items", () => {
      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.Organization,
        organizationId: ORG_ID as OrganizationId,
      });
      fixture.detectChanges();

      const options = openMenu();
      (options[0] as HTMLElement).click();

      expect(navigate).toHaveBeenCalledWith(["/tabs/vault"], { replaceUrl: true });
    });
  });
});
