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
    } as never);

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

    it("separates the individual vault from an organization vault", () => {
      const personal = cipherView({ organizationId: undefined });
      const organization = cipherView({ organizationId: "org-1" as never });

      expect(applyFilter(personal, { vault: MY_VAULT })).toBe(true);
      expect(applyFilter(organization, { vault: MY_VAULT })).toBe(false);
      expect(applyFilter(organization, { vault: "org-1" })).toBe(true);
      expect(applyFilter(organization, { vault: "org-2" })).toBe(false);
    });

    it("filters by shared folder membership", () => {
      const cipher = cipherView({ collectionIds: ["col-1", "col-2"] as never });

      expect(applyFilter(cipher, { sharedFolder: "col-2" })).toBe(true);
      expect(applyFilter(cipher, { sharedFolder: "col-3" })).toBe(false);
    });

    it("filters by folder, including items with no folder", () => {
      const filed = cipherView({ folderId: "folder-1" as never });
      const unfiled = cipherView({ folderId: undefined });

      expect(applyFilter(filed, { folder: "folder-1" })).toBe(true);
      expect(applyFilter(filed, { folder: NO_FOLDER })).toBe(false);
      expect(applyFilter(unfiled, { folder: NO_FOLDER })).toBe(true);
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

      expect(applyFilter(cipher, { vault: "org-1" })).toBe(true);
      expect(applyFilter(cipher, { folder: "folder-1" })).toBe(true);
      expect(applyFilter(cipher, { sharedFolder: "col-1" })).toBe(true);
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
