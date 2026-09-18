import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { DialogService, SideNavService } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";
import {
  VaultFilter,
  VaultFilterServiceAbstraction,
  RoutedVaultFilterBridgeService,
} from "@bitwarden/vault";

import { CollectionFilterComponent } from "./filters/collection-filter.component";
import { FolderFilterComponent } from "./filters/folder-filter.component";
import { OrganizationFilterComponent } from "./filters/organization-filter.component";
import { StatusFilterComponent } from "./filters/status-filter.component";
import { TypeFilterComponent } from "./filters/type-filter.component";
import { PersistedVaultFilterExpansionService } from "./services/persisted-vault-filter-expansion.service";
import { VaultFilterComponent } from "./vault-filter.component";

@Component({
  selector: "app-organization-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class OrganizationFilterStubComponent {
  readonly activeFilter = input<unknown>();
  readonly organizations = input<unknown>();
  readonly activeOrganizationDataOwnership = input<unknown>();
  readonly activeSingleOrganizationPolicy = input<unknown>();
}

@Component({
  selector: "app-type-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TypeFilterStubComponent {
  readonly activeFilter = input<unknown>();
  readonly cipherTypes = input<unknown>();
}

@Component({
  selector: "app-status-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StatusFilterStubComponent {
  readonly activeFilter = input<unknown>();
}

@Component({
  selector: "app-collection-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CollectionFilterStubComponent {
  readonly activeFilter = input<unknown>();
  readonly collection = input<unknown>();
}

@Component({
  selector: "app-folder-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FolderFilterStubComponent {
  readonly activeFilter = input<unknown>();
  readonly folder = input<unknown>();
  readonly onEditFolder = output<unknown>();
}

describe("VaultFilterComponent", () => {
  let fixture: ComponentFixture<VaultFilterComponent>;
  let collapseService: MockProxy<PersistedVaultFilterExpansionService>;

  const treeOf = (...children: { id: string; name: string; enabled?: boolean }[]) => {
    const root = new TreeNode<any>({ id: "root", name: "root" }, null);
    root.children = children.map((child) => new TreeNode<any>(child, root));
    return root;
  };

  const configure = async (
    vfo1Enabled: boolean,
    options: { routes?: Parameters<typeof provideRouter>[0] } = {},
  ) => {
    TestBed.resetTestingModule();
    collapseService = mock<PersistedVaultFilterExpansionService>();
    collapseService.isOpen.mockReturnValue(true);
    collapseService.setOpen.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [VaultFilterComponent],
      providers: [
        provideRouter(options.routes ?? []),
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(vfo1Enabled) } },
        {
          provide: VaultFilterServiceAbstraction,
          useValue: {
            organizationTree$: of(treeOf({ id: "org-1", name: "Acme", enabled: true })),
            collectionTree$: of(treeOf({ id: "collection-1", name: "Marketing" })),
            folderTree$: of(treeOf({ id: "folder-1", name: "Receipts" })),
            cipherTypeTree$: of(treeOf()),
          },
        },
        {
          provide: RoutedVaultFilterBridgeService,
          useValue: { activeFilter$: of(new VaultFilter()) },
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "user-1" as UserId }) },
        },
        { provide: PolicyService, useValue: { policyAppliesToUser$: () => of(false) } },
        { provide: FolderService, useValue: mock<FolderService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        { provide: PersistedVaultFilterExpansionService, useValue: collapseService },
      ],
    });

    TestBed.overrideComponent(VaultFilterComponent, {
      remove: {
        imports: [
          OrganizationFilterComponent,
          TypeFilterComponent,
          StatusFilterComponent,
          CollectionFilterComponent,
          FolderFilterComponent,
        ],
      },
      add: {
        imports: [
          OrganizationFilterStubComponent,
          TypeFilterStubComponent,
          StatusFilterStubComponent,
          CollectionFilterStubComponent,
          FolderFilterStubComponent,
        ],
      },
    });

    await TestBed.compileComponents();

    TestBed.inject(SideNavService).open.set(true);
  };

  const setup = async (vfo1Enabled: boolean) => {
    await configure(vfo1Enabled);

    fixture = TestBed.createComponent(VaultFilterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Nav groups only project their children once expanded, and the vault group is collapsed by default.
    fixture.debugElement.query(By.css("bit-nav-group")).componentInstance.open.set(true);
    fixture.detectChanges();
  };

  const navGroupTitles = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll("bit-nav-group[title]") as NodeListOf<HTMLElement>,
    ).map((el) => el.title);

  it("labels the nav groups with collection terminology when the vfo1 flag is off", async () => {
    await setup(false);

    expect(navGroupTitles()).toEqual(["collections", "folders"]);
  });

  it("labels the nav groups with shared folder terminology when the vfo1 flag is on", async () => {
    await setup(true);

    expect(navGroupTitles()).toEqual(["sharedFolders", "myFolders"]);
  });

  describe("collapse persistence", () => {
    /**
     * Simulates the `mousedown`/`keydown` that a real interaction always fires before any nested
     * click handler (e.g. the chevron's `toggle()`), which is how the component tells a genuine
     * user interaction apart from a programmatic force-open.
     */
    const simulatePointerDown = () => {
      (fixture.componentInstance as unknown as { onVaultGroupInteractionStart: () => void })[
        "onVaultGroupInteractionStart"
      ]();
    };

    // `bit-nav-group`'s own lifecycle-driven opens (e.g. its route-matching effect forcing a
    // top-level group open on construction) can fire an openChange before any user could have
    // clicked anything — e.g. right after a lock/unlock recreates this component. Reproducing
    // that exact render-scheduling race against the real component tree is inherently flaky, so
    // this drives the guard directly through the component's public onOpenChange while
    // controlling only the one signal ("settled") that models "has a real render happened since
    // isLoaded flipped true" — the same condition `ngOnInit`'s afterNextRender call sets.
    it("does not persist an open change that fires before the component settles", async () => {
      await setup(false);
      const instance = fixture.componentInstance as unknown as {
        settled: { set: (v: boolean) => void };
        onOpenChange: (nodeId: string | undefined, open: boolean) => void;
      };
      instance.settled.set(false);
      simulatePointerDown();

      instance.onOpenChange("Vault", true);

      expect(collapseService.setOpen).not.toHaveBeenCalled();
    });

    it("persists an open change from a genuine pointer interaction once settled", async () => {
      await setup(false);
      simulatePointerDown();

      fixture.debugElement.query(By.css("bit-nav-group")).componentInstance.setOpen(false);
      fixture.detectChanges();

      expect(collapseService.setOpen).toHaveBeenCalledWith("Vault", false);
    });

    // Regression test: unlike every other nav-group in this tree, the outer "Vault" wrapper
    // didn't set `disableToggleOnClick`, so an ordinary click on its body (e.g. just navigating
    // to "vault" — exactly what happens right after unlocking) also ran `toggle()` as a side
    // effect via `handleMainContentClicked()`. With persistence wired to `openChange`, that
    // silently flipped and overwrote whatever collapse state the user had actually saved.
    it("does not toggle or persist collapse state from clicking the group's main content", async () => {
      await setup(false);
      const navGroup = fixture.debugElement.query(By.css("bit-nav-group")).componentInstance;
      const openBefore = navGroup.open();
      collapseService.setOpen.mockClear();
      simulatePointerDown();

      navGroup["handleMainContentClicked"]();
      fixture.detectChanges();

      expect(navGroup.open()).toBe(openBefore);
      expect(collapseService.setOpen).not.toHaveBeenCalled();
    });

    // Regression test: `handleMainContentClicked()` unconditionally force-opens a group
    // (bypassing `disableToggleOnClick` entirely) when the side nav itself is collapsed to its
    // icon rail — e.g. clicking the "Vault" rail icon to navigate there right after unlocking.
    // That's the side nav expanding, not the user asking to remember "Vault" as expanded, so it
    // must not overwrite a saved collapsed preference.
    it("reverts and does not persist an open forced by clicking the rail icon while the side nav is collapsed", async () => {
      await setup(false);
      const navGroup = fixture.debugElement.query(By.css("bit-nav-group")).componentInstance;
      // Start from a genuinely collapsed group (mirroring a saved collapsed preference), so the
      // forced re-open below is an actual signal transition and fires openChange — starting from
      // the mocked isOpen()'s default `true` would make `.open.set(true)` a no-op that never
      // emits. isOpen is also updated to reflect that the persisted preference is now collapsed,
      // matching what the earlier (unmocked) setOpen call would have caused in the real service.
      simulatePointerDown();
      navGroup["toggle"]();
      fixture.detectChanges();
      expect(navGroup.open()).toBe(false);
      collapseService.isOpen.mockReturnValue(false);
      collapseService.setOpen.mockClear();

      TestBed.inject(SideNavService).open.set(false);
      simulatePointerDown();
      navGroup["handleMainContentClicked"]();
      fixture.detectChanges();

      // Visually corrected back to the persisted (collapsed) preference — Angular's [open]
      // binding wouldn't naturally re-assert this on its own, since isOpen()'s result didn't
      // change across the forced open/revert. The correction is a real model write, so it fires
      // its own openChange(false), which legitimately (if redundantly) re-persists "collapsed" —
      // what matters is that "Vault" is never persisted as *open*.
      expect(navGroup.open()).toBe(false);
      expect(collapseService.setOpen).not.toHaveBeenCalledWith("Vault", true);
      expect(collapseService.setOpen).toHaveBeenCalledWith("Vault", false);
    });

    it("still toggles and persists collapse state from the dedicated chevron toggle", async () => {
      await setup(false);
      const navGroup = fixture.debugElement.query(By.css("bit-nav-group")).componentInstance;
      collapseService.setOpen.mockClear();
      simulatePointerDown();

      navGroup["toggle"]();
      fixture.detectChanges();

      expect(collapseService.setOpen).toHaveBeenCalledWith("Vault", false);
    });

    // Regression test: a browser dispatches `mousedown` and `click` as separate tasks, not back
    // to back in the same synchronous call stack (unlike the tests above, which call the two
    // synchronously). The "genuine interaction" signal must survive that real gap, or the toggle
    // becomes permanently unresponsive — clearing it on the next microtask (rather than a timer)
    // previously broke this exact case.
    it("still toggles after a real task boundary between mousedown and the click", async () => {
      await setup(false);
      const navGroup = fixture.debugElement.query(By.css("bit-nav-group")).componentInstance;
      collapseService.setOpen.mockClear();

      simulatePointerDown();
      await new Promise((resolve) => setTimeout(resolve, 0)); // separate macrotask, like a real click
      navGroup["toggle"]();
      fixture.detectChanges();

      expect(collapseService.setOpen).toHaveBeenCalledWith("Vault", false);
    });

    // Regression test: keyboard activation (Enter/Space) of the chevron button fires `click`
    // without a preceding `mousedown`, so a `mousedown`-only "genuine interaction" signal makes
    // the toggle unreachable by keyboard — a real accessibility regression, not just a mouse-only
    // edge case. `(keydown)` on the group must independently satisfy the same signal.
    it("still toggles from keyboard activation, with no mousedown involved", async () => {
      await setup(false);
      const navGroupEl = fixture.debugElement.query(By.css("bit-nav-group"));
      const navGroup = navGroupEl.componentInstance;
      collapseService.setOpen.mockClear();

      navGroupEl.nativeElement.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      navGroup["toggle"]();
      fixture.detectChanges();

      expect(collapseService.setOpen).toHaveBeenCalledWith("Vault", false);
    });

    // Regression test: `NavItemComponent.setIsActive()` (nav-item.component.ts) unconditionally
    // forces its parent group open — `this.parentNavGroup.setOpen(true)` — whenever its own
    // `routerLinkActive` matches the current route. The "Vault" group's own header row is exactly
    // such an item (route="vault"), so this fires whenever the vault route is active — regardless
    // of the side nav's open/collapsed state, and regardless of vfo1. Reported symptom: this
    // happens specifically while the side nav is *expanded* (the collapsed case is separately
    // guarded via handleMainContentClicked's rail-click path).
    it("does not persist an open forced by the route becoming active while the side nav is expanded", async () => {
      await configure(false, { routes: [{ path: "vault", children: [] }] });
      collapseService.isOpen.mockReturnValue(false); // user has "Vault" collapsed
      TestBed.inject(SideNavService).open.set(true); // side nav expanded

      const router = TestBed.inject(Router);
      await router.navigateByUrl("/vault"); // route already active before the component mounts

      fixture = TestBed.createComponent(VaultFilterComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Simulate the consequence of `routerLinkActive` matching on the "Vault" group's own
      // composing nav-item — (isActiveChange)="setIsActive($event)" in nav-item.component.html —
      // directly, since real router-link activation isn't reliably reproducible in this harness.
      // No mousedown is simulated: this must be indistinguishable from the real mechanism, which
      // fires from router navigation, never from a pointer interaction on this component.
      const navGroup = fixture.debugElement.query(By.css("bit-nav-group")).componentInstance;
      const navItem = fixture.debugElement.query(By.css("bit-nav-item")).componentInstance;

      navItem["setIsActive"](true);
      fixture.detectChanges();

      // Visually corrected back to the persisted (collapsed) preference, not just un-persisted —
      // Angular's [open] binding wouldn't naturally re-assert this on its own, since isOpen()'s
      // result didn't change across the forced open/revert.
      expect(navGroup.open()).toBe(false);
      expect(collapseService.setOpen).not.toHaveBeenCalledWith("Vault", true);
    });
  });
});
