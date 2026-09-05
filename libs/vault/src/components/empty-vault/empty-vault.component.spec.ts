import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { VaultScope, VaultScopeType } from "../../models/vault-scope";

import { EmptyVaultComponent } from "./empty-vault.component";

describe("EmptyVaultComponent", () => {
  let fixture: ComponentFixture<EmptyVaultComponent>;
  let component: EmptyVaultComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyVaultComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: string[]) => [key, ...args].join(" ").trim() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyVaultComponent);
    component = fixture.componentInstance;

    // Required inputs — set defaults before the first detectChanges.
    fixture.componentRef.setInput("hasItems", false);
    fixture.detectChanges();
  });

  /** The projected "Clear search"/"Clear all" button, identified by its slot attribute. */
  function actionButton(): HTMLButtonElement | null {
    return fixture.debugElement.query(By.css('button[slot="button"]'))?.nativeElement ?? null;
  }

  describe("with no scope input set", () => {
    it("renders nothing when the vault has items and no filter is active", () => {
      fixture.componentRef.setInput("hasItems", true);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent.trim()).toBe("");
    });
  });

  describe("My vault", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("scope", { type: VaultScopeType.MyVault } satisfies VaultScope);
      fixture.detectChanges();
    });

    it("shows the My vault title and description when empty", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsInMyVault");
      expect(fixture.nativeElement.textContent).toContain("emptyVaultsDescription");
    });
  });

  describe("multiple vaults", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.AllItems,
      } satisfies VaultScope);
      fixture.componentRef.setInput("hasMultipleVaults", true);
      fixture.detectChanges();
    });

    it("shows the multi-vault title and description when every vault is empty", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsInVaults");
      expect(fixture.nativeElement.textContent).toContain("emptyVaultsDescription");
    });
  });

  describe("all items, single organization vault (data ownership policy)", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.AllItems,
      } satisfies VaultScope);
      fixture.componentRef.setInput("organizationName", "Acme Corp");
      fixture.detectChanges();
    });

    it("shows the organization vault title when the account's one vault is an organization's", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsInOrganizationVault Acme Corp");
    });

    it("renders nothing when no organization name resolved", () => {
      fixture.componentRef.setInput("organizationName", undefined);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent.trim()).toBe("");
    });
  });

  describe("an organization vault", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.Organization,
        organizationId: "org-1" as any,
      } satisfies VaultScope);
      fixture.componentRef.setInput("organizationName", "Acme Corp");
      fixture.detectChanges();
    });

    it("shows the organization vault title with the org name when empty", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsInOrganizationVault Acme Corp");
    });

    it("shows the generic empty-vault description", () => {
      expect(fixture.nativeElement.textContent).toContain("emptyVaultsDescription");
    });
  });

  describe("My items", () => {
    const myItemsCollectionId = "aaaa1111-bbbb-4ccc-8ddd-eeee11112222" as any;

    beforeEach(() => {
      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.Organization,
        organizationId: "org-1" as any,
        collectionId: myItemsCollectionId,
      } satisfies VaultScope);
      fixture.componentRef.setInput("organizationName", "Acme Corp");
      fixture.componentRef.setInput("defaultCollectionId", myItemsCollectionId);
      fixture.detectChanges();
    });

    it("shows the My items title when empty", () => {
      expect(fixture.nativeElement.textContent).toContain("emptyMyItems");
    });

    it("shows the My items description with the organization name", () => {
      expect(fixture.nativeElement.textContent).toContain("emptyMyItemsDescription Acme Corp");
    });

    it("takes priority over the organization vault and shared folder states", () => {
      fixture.componentRef.setInput("sharedFolderName", "Engineering");
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain("noItemsInOrganizationVault");
      expect(fixture.nativeElement.textContent).not.toContain("noItemsInSharedFolder");
    });
  });

  describe("a shared folder", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.Organization,
        organizationId: "org-1" as any,
      } satisfies VaultScope);
      fixture.componentRef.setInput("organizationName", "Acme Corp");
      fixture.componentRef.setInput("sharedFolderName", "Engineering");
      fixture.detectChanges();
    });

    it("shows the shared folder title with the folder name, not the organization's", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsInSharedFolder Engineering");
    });

    it("shows the shared folder description with the organization's name", () => {
      expect(fixture.nativeElement.textContent).toContain("emptySharedFolderDescription Acme Corp");
    });

    it("takes priority over the organization vault state", () => {
      expect(fixture.nativeElement.textContent).not.toContain("noItemsInOrganizationVault");
    });
  });

  describe("trash", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("scope", { type: VaultScopeType.Trash } satisfies VaultScope);
      fixture.detectChanges();
    });

    it("shows the trash title and description when empty", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsInTrash");
      expect(fixture.nativeElement.textContent).toContain("noItemsInTrashDescription");
    });

    it("takes priority over personal vault and organization states", () => {
      // Trash scope is unambiguous — passing extra org name / hasMultipleVaults has no effect
      fixture.componentRef.setInput("organizationName", "Acme Corp");
      fixture.componentRef.setInput("hasMultipleVaults", true);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("noItemsInTrash");
      expect(fixture.nativeElement.textContent).not.toContain("noItemsInMyVault");
      expect(fixture.nativeElement.textContent).not.toContain("noItemsInOrganizationVault");
    });
  });

  describe("archive", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("scope", { type: VaultScopeType.Archive } satisfies VaultScope);
      fixture.detectChanges();
    });

    it("shows the archive title and description when empty", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsInArchive");
      expect(fixture.nativeElement.textContent).toContain("noItemsInArchiveDesc");
    });

    it("takes priority over personal vault and organization states", () => {
      // Archive scope is unambiguous — passing extra org name / hasMultipleVaults has no effect
      fixture.componentRef.setInput("organizationName", "Acme Corp");
      fixture.componentRef.setInput("hasMultipleVaults", true);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("noItemsInArchive");
      expect(fixture.nativeElement.textContent).not.toContain("noItemsInMyVault");
      expect(fixture.nativeElement.textContent).not.toContain("noItemsInOrganizationVault");
    });
  });

  describe("no search matches", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("hasItems", true);
      fixture.componentRef.setInput("filterValues", { search: "example search" });
      fixture.detectChanges();
    });

    it("shows the no-search-matches title with the search term", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsMatchSearchTerm example search");
    });

    it("shows a Clear search button that emits clearSearch when clicked", () => {
      jest.spyOn(component.clearSearch, "emit");

      actionButton()!.click();

      expect(component.clearSearch.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe("no filter matches", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("hasItems", true);
      fixture.componentRef.setInput("filterValues", { favorites: true });
      fixture.detectChanges();
    });

    it("shows the no-filter-matches title", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsMatchSelectedFilters");
    });

    it("shows a Clear all button that emits clearFilters when clicked", () => {
      jest.spyOn(component.clearFilters, "emit");

      actionButton()!.click();

      expect(component.clearFilters.emit).toHaveBeenCalledTimes(1);
    });

    it("takes priority over My vault and organization states", () => {
      fixture.componentRef.setInput("scope", { type: VaultScopeType.MyVault } satisfies VaultScope);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("noItemsMatchSelectedFilters");
      expect(fixture.nativeElement.textContent).not.toContain("noItemsInMyVault");
    });
  });
});

@Component({
  selector: "test-host",
  imports: [EmptyVaultComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <vault-empty-vault
      [hasItems]="hasItems()"
      [filterValues]="filterValues()"
      [scope]="scope()"
      [organizationName]="organizationName()"
      [hasMultipleVaults]="hasMultipleVaults()"
      [sharedFolderName]="sharedFolderName()"
      [defaultCollectionId]="defaultCollectionId()"
    >
      <button slot="empty-add-item" type="button">Add item</button>
    </vault-empty-vault>
  `,
})
class TestHostComponent {
  readonly hasItems = signal(false);
  readonly filterValues = signal({});
  readonly scope = signal<VaultScope | undefined>(undefined);
  readonly organizationName = signal<string | undefined>(undefined);
  readonly hasMultipleVaults = signal(false);
  readonly sharedFolderName = signal<string | undefined>(undefined);
  readonly defaultCollectionId = signal<string | undefined>(undefined);
}

describe("EmptyVaultComponent's empty-add-item slot", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: string[]) => [key, ...args].join(" ").trim() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function addItemButton(): HTMLButtonElement | null {
    return fixture.debugElement.query(By.css('[slot="empty-add-item"]'))?.nativeElement ?? null;
  }

  it.each([
    ["My vault", () => host.scope.set({ type: VaultScopeType.MyVault })],
    [
      "an organization vault",
      () => {
        host.scope.set({ type: VaultScopeType.Organization, organizationId: "org-1" as any });
        host.organizationName.set("Acme Corp");
      },
    ],
    [
      "multiple empty vaults",
      () => {
        host.scope.set({ type: VaultScopeType.AllItems });
        host.hasMultipleVaults.set(true);
      },
    ],
    [
      "an empty shared folder",
      () => {
        host.scope.set({ type: VaultScopeType.Organization, organizationId: "org-1" as any });
        host.organizationName.set("Acme Corp");
        host.sharedFolderName.set("Engineering");
      },
    ],
    [
      "My items",
      () => {
        const myItemsId = "aaaa1111-bbbb-4ccc-8ddd-eeee11112222";
        host.scope.set({
          type: VaultScopeType.Organization,
          organizationId: "org-1" as any,
          collectionId: myItemsId as any,
        });
        host.organizationName.set("Acme Corp");
        host.defaultCollectionId.set(myItemsId);
      },
    ],
  ])("is projected for %s", (_name, setScope) => {
    setScope();
    fixture.detectChanges();

    expect(addItemButton()).not.toBeNull();
  });

  it("is not projected when there are no items at all and no scope is set", () => {
    fixture.detectChanges();

    expect(addItemButton()).toBeNull();
  });

  it("is not projected for the no-search-matches state", () => {
    host.hasItems.set(true);
    host.filterValues.set({ search: "example" });
    fixture.detectChanges();

    expect(addItemButton()).toBeNull();
  });

  it("is not projected for the no-filter-matches state", () => {
    host.hasItems.set(true);
    host.filterValues.set({ favorites: true });
    fixture.detectChanges();

    expect(addItemButton()).toBeNull();
  });

  it("is not projected for the trash state", () => {
    host.scope.set({ type: VaultScopeType.Trash });
    fixture.detectChanges();

    expect(addItemButton()).toBeNull();
  });

  it("is not projected for the archive state", () => {
    host.scope.set({ type: VaultScopeType.Archive });
    fixture.detectChanges();

    expect(addItemButton()).toBeNull();
  });
});
