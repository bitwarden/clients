import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
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
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  SearchService as DefaultSearchService,
  SearchTextDebounceInterval,
} from "@bitwarden/common/vault/services/search.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BitTableV2Component, DialogService, FilterControl } from "@bitwarden/components";
import { CipherListView } from "@bitwarden/sdk-internal";

import { CopyCipherFieldService } from "../../services/copy-cipher-field.service";

import {
  MY_VAULT,
  NO_FOLDER,
  VaultItemsTableColumn,
  VaultItemsTableComponent,
  VaultItemsTableFilters,
} from "./vault-items-table.component";

/** Builds a `CipherView` — the fully decrypted shape. */
function cipherView(overrides: Partial<CipherView> = {}): CipherView {
  if (!overrides.organizationId && overrides.collectionIds?.length) {
    throw new Error(
      "Fixture is in the individual vault but has shared folders; only organization-owned items " +
        "can belong to a shared folder.",
    );
  }

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
  let searchService: DefaultSearchService;

  // CDK's CdkVirtualScrollViewport.ngOnInit() defers initialization in a Promise.resolve().then(),
  // which never resolves during synchronous fixture.detectChanges() calls in JSDOM. Patch it to
  // run synchronously so the scroll strategy attaches and sets the rendered range before
  // CdkVirtualForOf.ngDoCheck() runs, allowing rows to appear in the same detectChanges() call.
  const originalNgOnInit = CdkVirtualScrollViewport.prototype.ngOnInit;
  beforeAll(() => {
    CdkVirtualScrollViewport.prototype.ngOnInit = function (this: CdkVirtualScrollViewport) {
      (this as any)["_measureViewportSize"]();
      (this as any)["_scrollStrategy"].attach(this);
    };
  });
  afterAll(() => {
    CdkVirtualScrollViewport.prototype.ngOnInit = originalNgOnInit;
  });

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

    searchService = new DefaultSearchService(mock<LogService>(), {
      locale$: of("en"),
    } as I18nService);

    await TestBed.configureTestingModule({
      imports: [VaultItemsTableComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccountService, useValue: accountService },
        // The real search service, not a double — the table's contract is that its search matches
        // what a client's own vault search matches, and a double could only assert fiction.
        { provide: SearchService, useValue: searchService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: DomainSettingsService, useValue: domainSettingsService },
        { provide: ConfigService, useValue: configService },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: CopyCipherFieldService, useValue: mock<CopyCipherFieldService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
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

  /** The projected `bit-table-v2` instance, for driving its registered `FilterControl`s directly. */
  function bitTable(): BitTableV2Component<
    CipherViewLike,
    VaultItemsTableColumn,
    VaultItemsTableFilters
  > {
    return fixture.debugElement.query(By.directive(BitTableV2Component)).componentInstance;
  }

  /** The registered `FilterControl` for a chip's `key` (or the adopted `bit-search`, under `"search"`). */
  function filterControl(key: string): FilterControl {
    const control = bitTable()
      .filterControls()
      .find((c) => c.key() === key);
    if (!control) {
      throw new Error(`No FilterControl registered under key "${key}"`);
    }
    return control;
  }

  /**
   * Types into the search box and settles the async search: the pipeline's `toObservable` sources
   * flush on change detection, its debounce on `tick`, and the resolved matches on the pass after.
   * Only callable from `fakeAsync`.
   */
  function search(term: string): void {
    filterControl("search").setValue(term);
    fixture.detectChanges();
    tick(SearchTextDebounceInterval);
    fixture.detectChanges();
  }

  /** The names of the rows surviving the table's filters — what it renders, pre-sort. */
  function filteredNames(): string[] {
    return bitTable()
      .filtered()
      .map((cipher) => cipher.name);
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
      const cipher = cipherView({
        organizationId: "org-1" as never,
        collectionIds: ["col-1", "col-2"] as never,
      });
      const other = cipherView({
        organizationId: "org-1" as never,
        collectionIds: ["col-3"] as never,
      });

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

      expect(applyFilter(cipher, { type: CipherType.Login, favorites: false })).toBe(true);
      expect(applyFilter(cipher, { type: CipherType.Login, favorites: true })).toBe(false);
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

  /**
   * Search is the one filter the predicate doesn't answer itself — it defers to `SearchService`,
   * asynchronously. These drive the real service through the search box rather than the predicate,
   * so what they assert is the behavior a client's own vault search has.
   */
  describe("search", () => {
    /** A login carrying a URI and a username, the fields only `SearchService` reaches. */
    function loginCipher(overrides: Partial<CipherView> = {}): CipherView {
      const login = new LoginView();
      login.username = "derek@example.com";
      login.uris = [Object.assign(new LoginUriView(), { uri: "https://shop.example.com" })];
      return cipherView({ login, ...overrides });
    }

    function withCiphers(ciphers: CipherViewLike[]): void {
      fixture.componentRef.setInput("ciphers", ciphers);
      fixture.detectChanges();
    }

    it("matches on name, case-insensitively", fakeAsync(() => {
      withCiphers([
        cipherView({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Netflix" }),
      ]);

      search("amaz");

      expect(filteredNames()).toEqual(["Amazon"]);
    }));

    it("matches on a login URI hostname", fakeAsync(() => {
      withCiphers([
        loginCipher({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Netflix" }),
      ]);

      search("shop.example");

      expect(filteredNames()).toEqual(["Amazon"]);
    }));

    it("matches on notes", fakeAsync(() => {
      withCiphers([
        cipherView({ id: "a", name: "Amazon", notes: "Shared with the ops team" }),
        cipherView({ id: "b", name: "Netflix" }),
      ]);

      search("ops team");

      expect(filteredNames()).toEqual(["Amazon"]);
    }));

    it("matches diacritic-insensitively", fakeAsync(() => {
      withCiphers([
        cipherView({ id: "a", name: "Résumé" }),
        cipherView({ id: "b", name: "Netflix" }),
      ]);

      search("resume");

      expect(filteredNames()).toEqual(["Résumé"]);
    }));

    it("requires every term to match, in any order", fakeAsync(() => {
      withCiphers([
        cipherView({ id: "a", name: "Email Work MyCompany" }),
        cipherView({ id: "b", name: "Netflix" }),
      ]);

      search("mycomp mail");

      expect(filteredNames()).toEqual(["Email Work MyCompany"]);
    }));

    it("honors a `>`-prefixed lunr query", fakeAsync(() => {
      withCiphers([
        cipherView({ id: "cipher-aa", name: "Amazon" }),
        cipherView({ id: "cipher-bb", name: "Netflix" }),
      ]);

      search(">amazon");

      expect(filteredNames()).toEqual(["Amazon"]);
    }));

    it("leaves every row visible below the searchable minimum length", fakeAsync(() => {
      withCiphers([
        cipherView({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Netflix" }),
      ]);

      search("a");

      expect(filteredNames()).toEqual(["Amazon", "Netflix"]);
    }));

    it("leaves every row visible for a whitespace-only term", fakeAsync(() => {
      withCiphers([
        cipherView({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Netflix" }),
      ]);

      search("   ");

      expect(filteredNames()).toEqual(["Amazon", "Netflix"]);
    }));

    it("composes with a chip filter", fakeAsync(() => {
      withCiphers([
        cipherView({ id: "a", name: "Amazon", type: CipherType.Login }),
        cipherView({ id: "b", name: "Amazon card", type: CipherType.Card }),
      ]);

      search("amazon");
      filterControl("type").setValue(CipherType.Card);
      fixture.detectChanges();

      expect(filteredNames()).toEqual(["Amazon card"]);
    }));

    it("survives a failed search and keeps searching afterwards", fakeAsync(() => {
      withCiphers([
        cipherView({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Netflix" }),
      ]);
      jest.spyOn(searchService, "searchCiphers").mockRejectedValueOnce(new Error("search failed"));

      search("amazon");

      // A failed search filters nothing out rather than emptying the table.
      expect(filteredNames()).toEqual(["Amazon", "Netflix"]);

      // And the next one still works: `toSignal` latches an error permanently and drops its
      // subscription, so without a scoped `catchError` this read would throw instead.
      search("netflix");

      expect(filteredNames()).toEqual(["Netflix"]);
    }));

    it("keeps rows matched when a re-decryption replaces every cipher object", fakeAsync(() => {
      withCiphers([cipherView({ id: "a", name: "Amazon" })]);
      search("amazon");
      expect(filteredNames()).toEqual(["Amazon"]);

      // What `cipherListViews$` hands back after any vault change: the same ciphers as all-new
      // objects. Matches are keyed by id, so the row survives the swap instead of blanking out
      // until the search re-resolves — hence no `tick` before asserting.
      fixture.componentRef.setInput("ciphers", [cipherView({ id: "a", name: "Amazon" })]);
      fixture.detectChanges();

      expect(filteredNames()).toEqual(["Amazon"]);

      tick(SearchTextDebounceInterval);
    }));
  });

  describe("availableCipherTypes", () => {
    it("offers only the types actually present among the ciphers", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({ type: CipherType.SecureNote }),
        cipherView({ type: CipherType.Login }),
      ]);

      // Preserves cipherTypes()'s (i.e. ALL_CIPHER_TYPES's) ordering — Login before
      // SecureNote — rather than the order the ciphers happen to appear in.
      expect(component["availableCipherTypes"]()).toEqual([
        CipherType.Login,
        CipherType.SecureNote,
      ]);
    });

    it("narrows within a client-narrowed cipherTypes input", () => {
      fixture.componentRef.setInput("cipherTypes", [CipherType.Login, CipherType.Card]);
      fixture.componentRef.setInput("ciphers", [
        // Present but excluded from cipherTypes — must not show up in the menu.
        cipherView({ type: CipherType.SecureNote }),
        cipherView({ type: CipherType.Login }),
      ]);

      // Card is in cipherTypes but no cipher has it, so it's excluded too.
      expect(component["availableCipherTypes"]()).toEqual([CipherType.Login]);
    });

    it("does not narrow further once a type filter is active — the trapped-menu regression guard", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({ type: CipherType.Login }),
        cipherView({ type: CipherType.Card }),
      ]);
      fixture.detectChanges();

      expect(component["availableCipherTypes"]()).toEqual([CipherType.Login, CipherType.Card]);

      // Selecting "Login" must not strip "Card" out of the menu — that would trap the
      // user on "Login" with no way back. availableCipherTypes is derived from the
      // unfiltered `ciphers()` input, not from the table's filtered rows.
      filterControl("type").setValue(CipherType.Login);
      fixture.detectChanges();

      expect(component["availableCipherTypes"]()).toEqual([CipherType.Login, CipherType.Card]);
    });
  });

  describe("disabled filter chips", () => {
    describe("Favorites", () => {
      it("is disabled with a tooltip when no cipher is a favorite", () => {
        fixture.componentRef.setInput("ciphers", [cipherView({ favorite: false })]);

        expect(component["noFavorites"]()).toBe(true);
        expect(component["favoritesDisabledTooltip"]()).toBe("favoritesFilterTooltip");
      });

      it("is enabled with an empty tooltip when at least one cipher is a favorite", () => {
        fixture.componentRef.setInput("ciphers", [cipherView({ favorite: true })]);

        expect(component["noFavorites"]()).toBe(false);
        // Empty, not just falsy — bitTooltip only renders nothing for an empty string.
        expect(component["favoritesDisabledTooltip"]()).toBe("");
      });
    });

    describe("My folders", () => {
      it("is disabled with a tooltip when there are no folders", () => {
        fixture.componentRef.setInput("folders", []);

        expect(component["noFolders"]()).toBe(true);
        expect(component["foldersDisabledTooltip"]()).toBe("foldersFilterTooltip");
      });

      it("is enabled with an empty tooltip when there is at least one folder", () => {
        fixture.componentRef.setInput("folders", [{ id: "folder-1", name: "Work" } as FolderView]);

        expect(component["noFolders"]()).toBe(false);
        expect(component["foldersDisabledTooltip"]()).toBe("");
      });
    });
  });

  describe("vaults present in the rows", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme corporation" } as Organization,
        { id: "org-2", name: "Contoso" } as Organization,
      ]);
    });

    describe("multipleVaults", () => {
      it("is false when every cipher is in the individual vault", () => {
        fixture.componentRef.setInput("ciphers", [cipherView({ organizationId: undefined })]);

        expect(component["multipleVaults"]()).toBe(false);
      });

      /** The side-nav pre-filter case: one vault on screen, so the chip can't narrow anything. */
      it("is false when every cipher is in the same organization", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: "org-1" as never }),
          cipherView({ id: "b", organizationId: "org-1" as never }),
        ]);

        expect(component["multipleVaults"]()).toBe(false);
      });

      it("is true when ciphers span the individual vault and an organization", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: undefined }),
          cipherView({ id: "b", organizationId: "org-1" as never }),
        ]);

        expect(component["multipleVaults"]()).toBe(true);
      });

      it("is true when ciphers span two organizations", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: "org-1" as never }),
          cipherView({ id: "b", organizationId: "org-2" as never }),
        ]);

        expect(component["multipleVaults"]()).toBe(true);
      });

      /** Nothing to name the organizations with, so the chip would have no options to offer. */
      it("stays false when the caller supplies no organizations", () => {
        fixture.componentRef.setInput("organizations", []);
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: undefined }),
          cipherView({ id: "b", organizationId: "org-1" as never }),
        ]);

        expect(component["multipleVaults"]()).toBe(false);
      });

      it("ignores an organization the caller didn't supply, since the chip can't offer it", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: undefined }),
          cipherView({ id: "b", organizationId: "org-unknown" as never }),
        ]);

        expect(component["multipleVaults"]()).toBe(false);
      });

      it("is false when there are no ciphers", () => {
        fixture.componentRef.setInput("ciphers", []);

        expect(component["multipleVaults"]()).toBe(false);
      });
    });

    describe("chip options", () => {
      it("omits an organization that holds no ciphers", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: undefined }),
          cipherView({ id: "b", organizationId: "org-2" as never }),
        ]);

        expect(component["sortedOrganizations"]().map((o) => o.id)).toEqual(["org-2"]);
      });

      it("omits My vault when every cipher is organization-owned", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: "org-1" as never }),
          cipherView({ id: "b", organizationId: "org-2" as never }),
        ]);

        expect(component["showMyVaultOption"]()).toBe(false);
      });

      it("offers My vault when some cipher is individually owned", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: undefined }),
          cipherView({ id: "b", organizationId: "org-1" as never }),
        ]);

        expect(component["showMyVaultOption"]()).toBe(true);
      });
    });

    describe("visibleColumns", () => {
      it("drops the Vault column when every row is in the same vault", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: "org-1" as never }),
          cipherView({ id: "b", organizationId: "org-1" as never }),
        ]);

        expect(component["visibleColumns"]()).not.toContain("vault");
      });

      it("keeps every configured column when the rows span vaults", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: undefined }),
          cipherView({ id: "b", organizationId: "org-1" as never }),
        ]);

        expect(component["visibleColumns"]()).toEqual(component["displayedColumns"]());
      });

      it("leaves the configured column set untouched", () => {
        fixture.componentRef.setInput("ciphers", [cipherView({ organizationId: undefined })]);

        expect(component["displayedColumns"]()).toContain("vault");
      });
    });
  });

  describe("showSharedFolders", () => {
    it("is false when every row is individually owned, which can't be in a collection", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "a", organizationId: undefined }),
        cipherView({ id: "b", organizationId: undefined }),
      ]);

      expect(component["showSharedFolders"]()).toBe(false);
      expect(component["visibleColumns"]()).not.toContain("sharedFolders");
    });

    it("is true when any row is organization-owned", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "a", organizationId: undefined }),
        cipherView({ id: "b", organizationId: "org-1" as never }),
      ]);

      expect(component["showSharedFolders"]()).toBe(true);
      expect(component["visibleColumns"]()).toContain("sharedFolders");
    });

    /**
     * Collection membership doesn't depend on the caller naming the organization, so this differs
     * from `multipleVaults` — which ignores organizations it can't name.
     */
    it("is true for an organization the caller didn't supply", () => {
      fixture.componentRef.setInput("organizations", []);
      fixture.componentRef.setInput("ciphers", [
        cipherView({ organizationId: "org-unknown" as never }),
      ]);

      expect(component["showSharedFolders"]()).toBe(true);
    });

    it("is false when there are no ciphers", () => {
      fixture.componentRef.setInput("ciphers", []);

      expect(component["showSharedFolders"]()).toBe(false);
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

    it("resolves shared folder chips and drops unknown ids", () => {
      const cipher = cipherView({
        organizationId: "org-1" as never,
        collectionIds: ["col-2", "col-unknown"] as never,
      });

      expect(component["sharedFolderChips"](cipher)).toEqual([
        { value: "col-2", name: "Engineering" },
      ]);
    });

    it("orders shared folder chips by name rather than by collectionIds order", () => {
      const cipher = cipherView({
        organizationId: "org-1" as never,
        // Ids whose names are reverse-alphabetical, so traversing them as given would fail this.
        collectionIds: ["col-1", "col-2"] as never,
      });

      expect(component["sharedFolderChips"](cipher)).toEqual([
        { value: "col-2", name: "Engineering" },
        { value: "col-1", name: "Operations" },
      ]);
    });

    it("resolves the folder as a single-entry chip list", () => {
      expect(component["folderChips"](cipherView({ folderId: "folder-1" as never }))).toEqual([
        { value: "folder-1", name: "Work" },
      ]);
      expect(component["folderChips"](cipherView({ folderId: undefined }))).toEqual([]);
    });
  });

  describe("filtering from a membership chip", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("collections", [
        { id: "col-1", name: "Operations" } as CollectionView,
        { id: "col-2", name: "Engineering" } as CollectionView,
      ]);
      fixture.componentRef.setInput("folders", [{ id: "folder-1", name: "Work" } as FolderView]);
    });

    /** A rendered membership chip, found by the name it displays. */
    function chipButton(name: string) {
      const chip = fixture.debugElement
        .queryAll(By.css("button[bit-chip-action]"))
        .find((candidate) => candidate.nativeElement.getAttribute("title") === name);
      if (!chip) {
        throw new Error(`No membership chip rendered for "${name}"`);
      }
      return chip.nativeElement as HTMLButtonElement;
    }

    it("narrows the Shared folders filter to the activated chip", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({
          organizationId: "org-1" as never,
          collectionIds: ["col-2"] as never,
        }),
      ]);
      fixture.detectChanges();

      chipButton("Engineering").click();
      fixture.detectChanges();

      expect(filterControl("sharedFolder").value()).toEqual(["col-2"]);
    });

    it("narrows the My folders filter to the activated chip", () => {
      fixture.componentRef.setInput("ciphers", [cipherView({ folderId: "folder-1" as never })]);
      fixture.detectChanges();

      chipButton("Work").click();
      fixture.detectChanges();

      expect(filterControl("folder").value()).toEqual(["folder-1"]);
    });

    /**
     * The chips are multi-select, so adding would also be defensible — replacing is the design
     * decision: activating a chip means "show me this folder", not "and this one too".
     */
    it("replaces the chip's existing selection rather than adding to it", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({
          organizationId: "org-1" as never,
          collectionIds: ["col-2"] as never,
        }),
      ]);
      fixture.detectChanges();

      filterControl("sharedFolder").setValue(["col-1"]);
      component["filterTo"](bitTable(), "sharedFolder", "col-2");

      expect(filterControl("sharedFolder").value()).toEqual(["col-2"]);
    });

    it("leaves the other filters untouched", () => {
      fixture.componentRef.setInput("ciphers", [cipherView({ folderId: "folder-1" as never })]);
      fixture.detectChanges();

      filterControl("search").setValue("amazon");
      filterControl("type").setValue(CipherType.Login);
      component["filterTo"](bitTable(), "folder", "folder-1");

      expect(filterControl("search").value()).toBe("amazon");
      expect(filterControl("type").value()).toBe(CipherType.Login);
    });

    it("names the chip after the action, not just the membership", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({
          organizationId: "org-1" as never,
          collectionIds: ["col-2"] as never,
        }),
      ]);
      fixture.detectChanges();

      expect(chipButton("Engineering").getAttribute("aria-label")).toBe("filterByName");
    });
  });

  describe("multi-select chip seeding from a scalar (URL param normalization)", () => {
    // When a multi-select chip is seeded from a single URL query param, the router decodes
    // it as a scalar string rather than an array. setValue() must normalize it so the chip
    // is active and filters correctly.

    beforeEach(() => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme" } as Organization,
      ]);
      fixture.componentRef.setInput("collections", [
        { id: "col-1", name: "Engineering", organizationId: "org-1" } as CollectionView,
      ]);
      fixture.componentRef.setInput("folders", [{ id: "folder-1", name: "Work" } as FolderView]);
      fixture.componentRef.setInput("ciphers", [
        cipherView({
          id: "a",
          name: "Match",
          organizationId: "org-1" as never,
          collectionIds: ["col-1"] as never,
          folderId: "folder-1" as never,
        }),
        cipherView({
          id: "b",
          name: "No match",
          organizationId: undefined,
          collectionIds: [] as never,
        }),
      ]);
      fixture.detectChanges();
    });

    it("vault chip seeded with a scalar string filters correctly", () => {
      filterControl("vault").setValue("org-1");
      fixture.detectChanges();

      expect(filterControl("vault").active()).toBe(true);
      expect(filteredNames()).toEqual(["Match"]);
    });

    it("sharedFolder chip seeded with a scalar string filters correctly", () => {
      filterControl("sharedFolder").setValue("col-1");
      fixture.detectChanges();

      expect(filterControl("sharedFolder").active()).toBe(true);
      expect(filteredNames()).toEqual(["Match"]);
    });

    it("folder chip seeded with a scalar string filters correctly", () => {
      filterControl("folder").setValue("folder-1");
      fixture.detectChanges();

      expect(filterControl("folder").active()).toBe(true);
      expect(filteredNames()).toEqual(["Match"]);
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
      const engineering = cipherView({
        organizationId: "org-1" as never,
        collectionIds: ["col-2"] as never,
      });
      const operations = cipherView({
        organizationId: "org-1" as never,
        collectionIds: ["col-1"] as never,
      });

      expect(component["sortBySharedFolders"](engineering, operations)).toBeLessThan(0);
    });

    it("orders shared folders by the alphabetically first collection, not the first id", () => {
      // Both are in Operations; only the second is also in Engineering, which should decide it.
      const operationsOnly = cipherView({
        organizationId: "org-1" as never,
        collectionIds: ["col-1"] as never,
      });
      const alsoEngineering = cipherView({
        organizationId: "org-1" as never,
        collectionIds: ["col-1", "col-2"] as never,
      });

      expect(component["sortBySharedFolders"](alsoEngineering, operationsOnly)).toBeLessThan(0);
    });

    it("sorts rows with no membership after named ones", () => {
      const withFolder = cipherView({ folderId: "folder-1" as never });
      const without = cipherView({ folderId: undefined });

      expect(component["sortByFolders"](without, withFolder)).toBeGreaterThan(0);
      expect(component["sortByFolders"](withFolder, without)).toBeLessThan(0);
      expect(component["sortByFolders"](without, without)).toBe(0);
    });
  });

  describe("row order", () => {
    /** The names of the rows the table renders, post-sort. */
    function sortedNames(): string[] {
      return bitTable()
        ["rows"]()
        .map((cipher) => cipher.name);
    }

    it("orders rows by name whatever order the host passes them in", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "c", name: "Zoom" }),
        cipherView({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Netflix" }),
      ]);
      fixture.detectChanges();

      expect(filteredNames()).toEqual(["Amazon", "Netflix", "Zoom"]);
    });

    /** Two rows in the same folder plus one unfiled — enough to see both the tie and the sentinel. */
    function setUpFolderSort(): void {
      fixture.componentRef.setInput("folders", [{ id: "folder-1", name: "Work" } as FolderView]);
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "c", name: "Zoom", folderId: "folder-1" as never }),
        cipherView({ id: "b", name: "Netflix", folderId: undefined }),
        cipherView({ id: "a", name: "Amazon", folderId: "folder-1" as never }),
      ]);
      fixture.detectChanges();
    }

    it("leaves ties on a synthetic column in name order", () => {
      setUpFolderSort();

      bitTable().sort.set({ column: "myFolders", direction: "asc" });
      fixture.detectChanges();

      // The two Work rows tie, so `sortByFolders` returns 0 and the stable sort keeps them in
      // name order; the unfiled row sorts last.
      expect(sortedNames()).toEqual(["Amazon", "Zoom", "Netflix"]);
    });

    it("moves rows with no membership to the top when the column sorts descending", () => {
      setUpFolderSort();

      bitTable().sort.set({ column: "myFolders", direction: "desc" });
      fixture.detectChanges();

      expect(sortedNames()).toEqual(["Netflix", "Amazon", "Zoom"]);
    });
  });

  describe("empty states", () => {
    it("explains that filters excluded everything when there is data", fakeAsync(() => {
      fixture.componentRef.setInput("ciphers", [cipherView({ name: "Amazon" })]);
      fixture.detectChanges();

      // Drives the search box the table adopts automatically under the reserved `search` key.
      search("no-such-item");

      expect(fixture.nativeElement.textContent).toContain("noMatchingItems");
    }));

    it("explains that the vault is empty when there is no data at all", () => {
      fixture.componentRef.setInput("ciphers", []);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("noItemsInVault");
    });
  });

  describe("empty state Clear all", () => {
    /** The empty state's "Clear all" button, present in the DOM only while `bit-table-v2` is empty. */
    function clearAllButton() {
      return fixture.debugElement.query(By.css('button[slot="button"]'));
    }

    describe("hasActiveChipFilters", () => {
      it("is false when no filter is active", () => {
        fixture.componentRef.setInput("ciphers", [cipherView({ name: "Amazon" })]);
        fixture.detectChanges();

        expect(component["hasActiveChipFilters"](bitTable())).toBe(false);
      });

      it("is true when a chip filter is active", () => {
        fixture.componentRef.setInput("ciphers", [cipherView({ type: CipherType.Login })]);
        fixture.detectChanges();

        filterControl("type").setValue(CipherType.Login);
        fixture.detectChanges();

        expect(component["hasActiveChipFilters"](bitTable())).toBe(true);
      });

      it("is false when only the search term is active — the search-only empty state guard", () => {
        fixture.componentRef.setInput("ciphers", [cipherView({ name: "Amazon" })]);
        fixture.detectChanges();

        filterControl("search").setValue("no-such-item");
        fixture.detectChanges();

        expect(component["hasActiveChipFilters"](bitTable())).toBe(false);
      });
    });

    describe("clearChipFilters", () => {
      it("resets chip controls but leaves the search control's value untouched", () => {
        fixture.componentRef.setInput("ciphers", [cipherView({ type: CipherType.Login })]);
        fixture.detectChanges();

        filterControl("type").setValue(CipherType.Login);
        filterControl("search").setValue("amazon");
        fixture.detectChanges();

        component["clearChipFilters"](bitTable());
        fixture.detectChanges();

        expect(filterControl("type").value()).toBeUndefined();
        expect(filterControl("search").value()).toBe("amazon");
      });
    });

    describe("rendered button visibility", () => {
      it("stays hidden when there is no data and no filter is active", () => {
        fixture.componentRef.setInput("ciphers", []);
        fixture.detectChanges();

        expect(clearAllButton().nativeElement.classList).toContain("tw-hidden");
      });

      it("shows once a chip filter empties the rows", () => {
        fixture.componentRef.setInput("ciphers", [cipherView({ type: CipherType.Login })]);
        fixture.detectChanges();

        filterControl("type").setValue(CipherType.Card);
        fixture.detectChanges();

        expect(clearAllButton().nativeElement.classList).not.toContain("tw-hidden");
      });

      it("stays hidden when only a search term empties the rows", fakeAsync(() => {
        fixture.componentRef.setInput("ciphers", [cipherView({ name: "Amazon" })]);
        fixture.detectChanges();

        search("no-such-item");

        expect(clearAllButton().nativeElement.classList).toContain("tw-hidden");
      }));
    });
  });

  it("always applies the flex fill host classes", () => {
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList).toContain("tw-flex");
    expect(host.classList).toContain("tw-flex-col");
    expect(host.classList).toContain("tw-flex-1");
    expect(host.classList).toContain("tw-min-h-0");
  });
});
