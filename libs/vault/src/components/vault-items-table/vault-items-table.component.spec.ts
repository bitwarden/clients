import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService } from "@bitwarden/components";
import { CipherListView } from "@bitwarden/sdk-internal";

import { CopyCipherFieldService } from "../../services/copy-cipher-field.service";

import { MY_VAULT, NO_FOLDER, VaultItemsTableComponent } from "./vault-items-table.component";

/** Builds a `CipherView` — the fully decrypted shape. */
function cipherView(overrides: Partial<CipherView> = {}): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.name = "Amazon";
  cipher.type = CipherType.Login;
  Object.assign(cipher, overrides);
  return cipher;
}

/**
 * Builds a `CipherListView` — the lighter SDK shape the table must handle equally. Its `type`
 * and `subtitle` differ in kind from `CipherView`, which is what makes it worth covering.
 */
function cipherListView(overrides: Partial<CipherListView> = {}): CipherListView {
  return {
    id: "cipher-1",
    name: "Amazon",
    subtitle: "derek@example.com",
    type: { login: { fido2Credentials: 0, hasTotp: false, totp: undefined } },
    favorite: false,
    organizationId: undefined,
    folderId: undefined,
    collectionIds: [],
    copyableFields: [],
    ...overrides,
  } as unknown as CipherListView;
}

describe("VaultItemsTableComponent", () => {
  let fixture: ComponentFixture<VaultItemsTableComponent<CipherViewLike>>;
  let component: VaultItemsTableComponent<CipherViewLike>;

  beforeEach(async () => {
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as Account);

    const environmentService = mock<EnvironmentService>();
    environmentService.environment$ = of({
      getIconsUrl: () => "https://icons.example.com",
    } as any);

    const domainSettingsService = mock<DomainSettingsService>();
    domainSettingsService.showFavicons$ = of(false);

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [VaultItemsTableComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccountService, useValue: accountService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: DomainSettingsService, useValue: domainSettingsService },
        { provide: ConfigService, useValue: configService },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: CopyCipherFieldService, useValue: mock<CopyCipherFieldService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    }).compileComponents();

    fixture =
      TestBed.createComponent<VaultItemsTableComponent<CipherViewLike>>(VaultItemsTableComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("ciphers", []);
  });

  /** The component's single filter predicate, which the table derives every other state from. */
  function applyFilter(cipher: CipherViewLike, values: Record<string, unknown>): boolean {
    return component["filter"](cipher, values as never);
  }

  it("renders a row per cipher", () => {
    fixture.componentRef.setInput("ciphers", [
      cipherView({ id: "a", name: "Amazon" }),
      cipherView({ id: "b", name: "Apple ID" }),
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("Amazon");
    expect(text).toContain("Apple ID");
  });

  describe("filtering", () => {
    it("matches everything when no filter is active", () => {
      expect(applyFilter(cipherView(), {})).toBe(true);
    });

    it("matches on name, case-insensitively", () => {
      const cipher = cipherView({ name: "Amazon" });

      expect(applyFilter(cipher, { search: "amaz" })).toBe(true);
      expect(applyFilter(cipher, { search: "netflix" })).toBe(false);
    });

    it("ignores a whitespace-only search term", () => {
      expect(applyFilter(cipherView({ name: "Amazon" }), { search: "   " })).toBe(true);
    });

    it("filters by cipher type for a CipherView", () => {
      const cipher = cipherView({ type: CipherType.Card });

      expect(applyFilter(cipher, { type: CipherType.Card })).toBe(true);
      expect(applyFilter(cipher, { type: CipherType.Login })).toBe(false);
    });

    it("filters by cipher type for a CipherListView, whose type is shaped differently", () => {
      const cipher = cipherListView();

      expect(applyFilter(cipher, { type: CipherType.Login })).toBe(true);
      expect(applyFilter(cipher, { type: CipherType.Card })).toBe(false);
    });

    it("filters to favorites only when the toggle is on", () => {
      expect(applyFilter(cipherView({ favorite: false }), { favorites: true })).toBe(false);
      expect(applyFilter(cipherView({ favorite: true }), { favorites: true })).toBe(true);
      // Off, the toggle must not exclude non-favorites.
      expect(applyFilter(cipherView({ favorite: false }), { favorites: false })).toBe(true);
    });

    describe("vault (multi-select)", () => {
      const personal = cipherView({ organizationId: undefined });
      const orgOne = cipherView({ organizationId: "org-1" as never });
      const orgTwo = cipherView({ organizationId: "org-2" as never });

      it("matches everything when unset", () => {
        expect(applyFilter(personal, { vault: undefined })).toBe(true);
        expect(applyFilter(orgOne, { vault: undefined })).toBe(true);
      });

      it("matches everything when cleared to an empty array — the multi-select regression guard", () => {
        expect(applyFilter(personal, { vault: [] })).toBe(true);
        expect(applyFilter(orgOne, { vault: [] })).toBe(true);
      });

      it("matches a single selected value", () => {
        expect(applyFilter(orgOne, { vault: ["org-1"] })).toBe(true);
        expect(applyFilter(orgTwo, { vault: ["org-1"] })).toBe(false);
      });

      it("ORs across multiple selected values", () => {
        expect(applyFilter(orgOne, { vault: ["org-1", "org-2"] })).toBe(true);
        expect(applyFilter(orgTwo, { vault: ["org-1", "org-2"] })).toBe(true);
        expect(applyFilter(personal, { vault: ["org-1", "org-2"] })).toBe(false);
      });

      it("matches the individual vault via the MY_VAULT sentinel, alone or combined", () => {
        expect(applyFilter(personal, { vault: [MY_VAULT] })).toBe(true);
        expect(applyFilter(orgOne, { vault: [MY_VAULT] })).toBe(false);
        expect(applyFilter(personal, { vault: [MY_VAULT, "org-1"] })).toBe(true);
        expect(applyFilter(orgOne, { vault: [MY_VAULT, "org-1"] })).toBe(true);
        expect(applyFilter(orgTwo, { vault: [MY_VAULT, "org-1"] })).toBe(false);
      });
    });

    describe("sharedFolder (multi-select)", () => {
      const cipher = cipherView({ collectionIds: ["col-1", "col-2"] as never });
      const other = cipherView({ collectionIds: ["col-3"] as never });

      it("matches everything when unset", () => {
        expect(applyFilter(cipher, { sharedFolder: undefined })).toBe(true);
      });

      it("matches everything when cleared to an empty array — the multi-select regression guard", () => {
        expect(applyFilter(cipher, { sharedFolder: [] })).toBe(true);
        expect(applyFilter(other, { sharedFolder: [] })).toBe(true);
      });

      it("matches a single selected value", () => {
        expect(applyFilter(cipher, { sharedFolder: ["col-2"] })).toBe(true);
        expect(applyFilter(cipher, { sharedFolder: ["col-3"] })).toBe(false);
      });

      it("ORs across multiple selected values", () => {
        expect(applyFilter(cipher, { sharedFolder: ["col-3", "col-1"] })).toBe(true);
        expect(applyFilter(other, { sharedFolder: ["col-3", "col-1"] })).toBe(true);
      });
    });

    describe("folder (multi-select)", () => {
      const filed = cipherView({ folderId: "folder-1" as never });
      const filedOther = cipherView({ folderId: "folder-2" as never });
      const unfiled = cipherView({ folderId: undefined });

      it("matches everything when unset", () => {
        expect(applyFilter(filed, { folder: undefined })).toBe(true);
      });

      it("matches everything when cleared to an empty array — the multi-select regression guard", () => {
        expect(applyFilter(filed, { folder: [] })).toBe(true);
        expect(applyFilter(unfiled, { folder: [] })).toBe(true);
      });

      it("matches a single selected value", () => {
        expect(applyFilter(filed, { folder: ["folder-1"] })).toBe(true);
        expect(applyFilter(filed, { folder: ["folder-2"] })).toBe(false);
      });

      it("ORs across multiple selected values", () => {
        expect(applyFilter(filed, { folder: ["folder-1", "folder-2"] })).toBe(true);
        expect(applyFilter(filedOther, { folder: ["folder-1", "folder-2"] })).toBe(true);
      });

      it("matches unfiled items via the NO_FOLDER sentinel, alone or combined", () => {
        expect(applyFilter(unfiled, { folder: [NO_FOLDER] })).toBe(true);
        expect(applyFilter(filed, { folder: [NO_FOLDER] })).toBe(false);
        expect(applyFilter(unfiled, { folder: [NO_FOLDER, "folder-1"] })).toBe(true);
        expect(applyFilter(filed, { folder: [NO_FOLDER, "folder-1"] })).toBe(true);
        expect(applyFilter(filedOther, { folder: [NO_FOLDER, "folder-1"] })).toBe(false);
      });
    });

    it("requires every active filter to match", () => {
      const cipher = cipherView({ name: "Amazon", type: CipherType.Login, favorite: false });

      expect(applyFilter(cipher, { search: "amazon", type: CipherType.Login })).toBe(true);
      expect(applyFilter(cipher, { search: "amazon", favorites: true })).toBe(false);
    });

    it("normalizes branded CipherListView ids before comparing", () => {
      const cipher = cipherListView({
        organizationId: "org-1" as never,
        folderId: "folder-1" as never,
        collectionIds: ["col-1"] as never,
      });

      expect(applyFilter(cipher, { vault: ["org-1"] })).toBe(true);
      expect(applyFilter(cipher, { folder: ["folder-1"] })).toBe(true);
      expect(applyFilter(cipher, { sharedFolder: ["col-1"] })).toBe(true);
    });
  });

  describe("resolving display names", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme corporation" } as Organization,
      ]);
      fixture.componentRef.setInput("collections", [
        { id: "col-1", name: "Operations" } as CollectionView,
        { id: "col-2", name: "Engineering" } as CollectionView,
      ]);
      fixture.componentRef.setInput("folders", [{ id: "folder-1", name: "Work" } as FolderView]);
    });

    it("labels the individual vault when a cipher has no organization", () => {
      expect(component["vaultName"](cipherView({ organizationId: undefined }))).toBe("myVault");
    });

    it("resolves an organization name", () => {
      expect(component["vaultName"](cipherView({ organizationId: "org-1" as never }))).toBe(
        "Acme corporation",
      );
    });

    it("falls back when the organization is unknown to the caller", () => {
      expect(component["vaultName"](cipherView({ organizationId: "org-x" as never }))).toBe(
        "organization",
      );
    });

    it("resolves shared folder names and drops unknown ids", () => {
      const cipher = cipherView({ collectionIds: ["col-2", "col-unknown"] as never });

      expect(component["sharedFolderNames"](cipher)).toEqual(["Engineering"]);
    });

    it("resolves the folder name as a single-entry list", () => {
      expect(component["folderNamesFor"](cipherView({ folderId: "folder-1" as never }))).toEqual([
        "Work",
      ]);
      expect(component["folderNamesFor"](cipherView({ folderId: undefined }))).toEqual([]);
    });
  });

  describe("grouping shared folders", () => {
    /** Builds `count` collections, split across "org-1" and "org-2", each with a distinct name. */
    function manyCollections(count: number): CollectionView[] {
      return Array.from(
        { length: count },
        (_, i) =>
          ({
            id: `col-${i}`,
            name: `Collection ${String(i).padStart(2, "0")}`,
            organizationId: i % 2 === 0 ? "org-1" : "org-2",
          }) as CollectionView,
      );
    }

    beforeEach(() => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme corporation" } as Organization,
        { id: "org-2", name: "Contoso" } as Organization,
      ]);
    });

    it("does not group at the threshold (10 collections)", () => {
      fixture.componentRef.setInput("collections", manyCollections(10));

      expect(component["groupSharedFolders"]()).toBe(false);
    });

    it("groups once past the threshold (11 collections)", () => {
      fixture.componentRef.setInput("collections", manyCollections(11));

      expect(component["groupSharedFolders"]()).toBe(true);
    });

    it("assigns each collection to its owning organization's group", () => {
      fixture.componentRef.setInput("collections", manyCollections(11));

      const groups = component["groupedSharedFolders"]();
      const acme = groups.find((g: { organizationId: string }) => g.organizationId === "org-1");
      const contoso = groups.find((g: { organizationId: string }) => g.organizationId === "org-2");

      expect(acme?.collections.map((c: CollectionView) => c.id)).toEqual([
        "col-0",
        "col-2",
        "col-4",
        "col-6",
        "col-8",
        "col-10",
      ]);
      expect(contoso?.collections.map((c: CollectionView) => c.id)).toEqual([
        "col-1",
        "col-3",
        "col-5",
        "col-7",
        "col-9",
      ]);
    });

    it("sorts groups by organization name and collections by name within each group", () => {
      fixture.componentRef.setInput("collections", [
        { id: "col-b", name: "B collection", organizationId: "org-2" } as CollectionView,
        { id: "col-a", name: "A collection", organizationId: "org-2" } as CollectionView,
        ...manyCollections(9),
      ]);

      const groups = component["groupedSharedFolders"]();

      expect(groups.map((g: { name: string }) => g.name)).toEqual(["Acme corporation", "Contoso"]);
      const contoso = groups.find((g: { organizationId: string }) => g.organizationId === "org-2");
      expect(contoso?.collections.map((c: CollectionView) => c.name)).toEqual([
        "A collection",
        "B collection",
        "Collection 01",
        "Collection 03",
        "Collection 05",
        "Collection 07",
      ]);
    });

    it("falls back to the localized 'organization' label when a collection's org is unknown", () => {
      fixture.componentRef.setInput("collections", [
        ...manyCollections(10),
        { id: "col-orphan", name: "Orphan", organizationId: "org-unknown" } as CollectionView,
      ]);

      const groups = component["groupedSharedFolders"]();
      const orphanGroup = groups.find(
        (g: { organizationId: string }) => g.organizationId === "org-unknown",
      );

      expect(orphanGroup?.name).toBe("organization");
    });
  });

  describe("sorting synthetic columns", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme corporation" } as Organization,
      ]);
      fixture.componentRef.setInput("collections", [
        { id: "col-1", name: "Operations" } as CollectionView,
        { id: "col-2", name: "Engineering" } as CollectionView,
      ]);
      fixture.componentRef.setInput("folders", [
        { id: "folder-1", name: "Work" } as FolderView,
        { id: "folder-2", name: "Finance" } as FolderView,
      ]);
    });

    it("orders the vault column by resolved name, not by id", () => {
      // "Acme corporation" sorts before "myVault" — comparing raw ids would not produce this.
      const organization = cipherView({ organizationId: "org-1" as never });
      const personal = cipherView({ organizationId: undefined });

      expect(component["sortByVault"](organization, personal)).toBeLessThan(0);
      expect(component["sortByVault"](personal, organization)).toBeGreaterThan(0);
    });

    it("orders shared folders by their first resolved name", () => {
      const engineering = cipherView({ collectionIds: ["col-2"] as never });
      const operations = cipherView({ collectionIds: ["col-1"] as never });

      expect(component["sortBySharedFolders"](engineering, operations)).toBeLessThan(0);
    });

    it("sorts rows with no membership last in either direction", () => {
      const withFolder = cipherView({ folderId: "folder-1" as never });
      const without = cipherView({ folderId: undefined });

      expect(component["sortByFolders"](without, withFolder)).toBeGreaterThan(0);
      expect(component["sortByFolders"](withFolder, without)).toBeLessThan(0);
      expect(component["sortByFolders"](without, without)).toBe(0);
    });
  });

  describe("empty states", () => {
    it("explains that filters excluded everything when there is data", () => {
      fixture.componentRef.setInput("ciphers", [cipherView({ name: "Amazon" })]);
      fixture.detectChanges();

      // Drive the search box the table adopts automatically under the reserved `search` key.
      // Queried by selector because `@bitwarden/components` exports only `SearchModule`.
      const search = fixture.debugElement.query(By.css("bit-search")).componentInstance as {
        writeValue(term: string): void;
      };
      search.writeValue("no-such-item");
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("noMatchingItems");
    });

    it("explains that the vault is empty when there is no data at all", () => {
      fixture.componentRef.setInput("ciphers", []);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("noItemsInVault");
    });
  });

  describe("selection", () => {
    it("keeps a stable config reference so the selection model is not rebuilt", () => {
      expect(component["selection"]).toBe(component["selection"]);
    });
  });
});
