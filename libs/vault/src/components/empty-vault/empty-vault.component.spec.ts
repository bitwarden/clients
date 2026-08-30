import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

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
      fixture.componentRef.setInput("isMyVaultScope", true);
      fixture.detectChanges();
    });

    it("shows the My vault title and description when empty", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsInMyVault");
      expect(fixture.nativeElement.textContent).toContain("emptyVaultsDescription");
    });
  });

  describe("multiple vaults", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("hasMultipleVaults", true);
      fixture.detectChanges();
    });

    it("shows the multi-vault title and description when every vault is empty", () => {
      expect(fixture.nativeElement.textContent).toContain("noItemsInVaults");
      expect(fixture.nativeElement.textContent).toContain("emptyVaultsDescription");
    });
  });

  describe("an organization vault", () => {
    beforeEach(() => {
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

  describe("a shared folder", () => {
    beforeEach(() => {
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
      fixture.componentRef.setInput("isMyVaultScope", true);
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
      [isMyVaultScope]="isMyVaultScope()"
      [organizationName]="organizationName()"
      [hasMultipleVaults]="hasMultipleVaults()"
      [sharedFolderName]="sharedFolderName()"
    >
      <button slot="empty-add-item" type="button">Add item</button>
    </vault-empty-vault>
  `,
})
class TestHostComponent {
  readonly hasItems = signal(false);
  readonly filterValues = signal({});
  readonly isMyVaultScope = signal(false);
  readonly organizationName = signal<string | undefined>(undefined);
  readonly hasMultipleVaults = signal(false);
  readonly sharedFolderName = signal<string | undefined>(undefined);
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
    ["My vault", () => host.isMyVaultScope.set(true)],
    ["an organization vault", () => host.organizationName.set("Acme Corp")],
    ["multiple empty vaults", () => host.hasMultipleVaults.set(true)],
    [
      "an empty shared folder",
      () => {
        host.organizationName.set("Acme Corp");
        host.sharedFolderName.set("Engineering");
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
});
