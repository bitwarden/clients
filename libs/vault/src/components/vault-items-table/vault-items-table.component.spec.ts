import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
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
import {
  BitTableV2Component,
  ButtonModule,
  DialogService,
  FilterControl,
  FilterMenuComponent,
  FilterOptionRow,
  FilterSectionComponent,
  SelectionConfig,
} from "@bitwarden/components";
import { Measurement } from "@bitwarden/logging";
import { CipherListView } from "@bitwarden/sdk-internal";

import { VaultScopeType } from "../../models/vault-scope";
import { CopyCipherFieldService } from "../../services/copy-cipher-field.service";
import { VaultBatchBarService, VaultSelectionSource } from "../../services/vault-batch-bar.service";
import { MY_VAULT, NO_FOLDER } from "../../utils/vault-filter-predicates";

import {
  MAX_SELECTION_COUNT,
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

/** Projects conditional toolbar actions the supported way — inside a static `slot="toolbar"`. */
@Component({
  selector: "test-wrapped-toolbar-host",
  template: `
    <vault-items-table [ciphers]="[]">
      <div slot="toolbar">
        @if (show()) {
          <button id="toolbar-action" type="button">Add</button>
        }
      </div>
    </vault-items-table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VaultItemsTableComponent],
})
class WrappedToolbarHostComponent {
  readonly show = signal(true);
}

/** Projects the same actions with the control flow block itself as the projected node. */
@Component({
  selector: "test-bare-toolbar-host",
  template: `
    <vault-items-table [ciphers]="[]">
      @if (show()) {
        <button slot="toolbar" id="toolbar-action" type="button" bitButton>Import</button>
        <span slot="toolbar" id="toolbar-second">Add</span>
      }
    </vault-items-table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VaultItemsTableComponent, ButtonModule],
})
class BareToolbarHostComponent {
  readonly show = signal(true);
}

function batchBarDouble() {
  const source = signal<VaultSelectionSource<CipherViewLike> | undefined>(undefined);
  const selected = computed(() => source()?.selected() ?? []);
  return {
    source,
    selected,
    selectedCount: computed(() => selected().length),
    barVisible: computed(() => selected().length > 0),
    registerSelection: (next: VaultSelectionSource<CipherViewLike>) => {
      source.set(next);
      return () => {
        if (source() === next) {
          source.set(undefined);
        }
      };
    },
  };
}

describe("VaultItemsTableComponent", () => {
  let fixture: ComponentFixture<VaultItemsTableComponent<CipherViewLike>>;
  let component: VaultItemsTableComponent<CipherViewLike>;
  let searchService: DefaultSearchService;
  let batchBar: ReturnType<typeof batchBarDouble>;

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
    batchBar = batchBarDouble();
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as Account);

    const avatarService = mock<AvatarService>();
    avatarService.getUserAvatarColor$.mockReturnValue(of("#175ddc"));

    const environmentService = mock<EnvironmentService>();
    environmentService.environment$ = of({
      getIconsUrl: () => "https://icons.example.com",
    } as any);

    const domainSettingsService = mock<DomainSettingsService>();
    domainSettingsService.showFavicons$ = of(false);

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    searchService = new DefaultSearchService(
      mock<LogService>({ startMeasurement: () => mock<Measurement>() }),
      {
        locale$: of("en"),
      } as I18nService,
    );

    await TestBed.configureTestingModule({
      imports: [VaultItemsTableComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccountService, useValue: accountService },
        { provide: AvatarService, useValue: avatarService },
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
        { provide: VaultBatchBarService, useValue: batchBar },
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

  /** The `bit-filter-menu` registered under `key` — every `FilterControl` here is one. */
  function filterMenu(key: string): FilterMenuComponent {
    return filterControl(key) as unknown as FilterMenuComponent;
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

  describe("clicking a row cell", () => {
    /** The `role="cell"` divs of the first body row, in column order. */
    function firstRowCells(): HTMLElement[] {
      const row = fixture.nativeElement.querySelector("bit-row");
      return Array.from(row.querySelectorAll('[role="cell"]'));
    }

    /**
     * The data cells — everything between the selection checkbox cell and the actions cell, which
     * are the two the row-click affordance deliberately leaves to their own controls.
     */
    function firstRowDataCells(): HTMLElement[] {
      return firstRowCells().slice(1, -1);
    }

    /** Two ciphers spanning both vaults, so every optional column and its chips render. */
    function renderRows(itemAction?: jest.Mock) {
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "a", name: "Amazon", organizationId: "org-1", collectionIds: ["col-1"] }),
        cipherView({ id: "b", name: "Bank" }),
      ]);
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme corporation" } as Organization,
      ]);
      fixture.componentRef.setInput("collections", [
        { id: "col-1", name: "Operations" } as CollectionView,
      ]);
      if (itemAction) {
        fixture.componentRef.setInput("itemAction", itemAction);
      }
      fixture.detectChanges();
    }

    it("runs itemAction from any data cell, not just the name button", () => {
      const itemAction = jest.fn();
      renderRows(itemAction);

      const dataCells = firstRowDataCells();
      expect(dataCells.length).toBeGreaterThan(1);

      for (const cell of dataCells) {
        itemAction.mockClear();
        cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(itemAction).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
      }
    });

    it("fires once, not twice, when the name button itself is clicked", () => {
      const itemAction = jest.fn();
      renderRows(itemAction);

      const nameButton = fixture.nativeElement.querySelector("bit-row button[bitlink]");
      nameButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(itemAction).toHaveBeenCalledTimes(1);
    });

    it("leaves the filter chips inside a cell to their own click handler", () => {
      const itemAction = jest.fn();
      renderRows(itemAction);

      const chip = fixture.nativeElement.querySelector("bit-row button[bit-chip-action]");
      expect(chip).not.toBeNull();
      chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(itemAction).not.toHaveBeenCalled();
    });

    it("ignores modifier clicks so selection and browser gestures stay available", () => {
      const itemAction = jest.fn();
      renderRows(itemAction);
      const cell = firstRowDataCells()[0];

      for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
        cell.dispatchEvent(new MouseEvent("click", { bubbles: true, [modifier]: true }));
      }

      expect(itemAction).not.toHaveBeenCalled();
    });

    it("does nothing when no itemAction is supplied", () => {
      renderRows();

      expect(() =>
        firstRowDataCells()[0].dispatchEvent(new MouseEvent("click", { bubbles: true })),
      ).not.toThrow();
    });
  });

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

  describe("projected toolbar content", () => {
    /** The projected action, as it lands inside the rendered toolbar. */
    const toolbarAction = (host: ComponentFixture<unknown>) =>
      host.nativeElement.querySelector("bit-table-toolbar #toolbar-action");

    it("reaches the toolbar when it is conditional within a static slot element", () => {
      const host = TestBed.createComponent(WrappedToolbarHostComponent);
      host.detectChanges();

      expect(toolbarAction(host)).not.toBeNull();

      host.componentInstance.show.set(false);
      host.detectChanges();

      expect(toolbarAction(host)).toBeNull();
    });

    it("drops a multi-node control flow block projected as the slot itself", () => {
      const host = TestBed.createComponent(BareToolbarHostComponent);
      host.detectChanges();

      expect(toolbarAction(host)).toBeNull();
    });
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

    it("filters to the My items collection only when the toggle is on", () => {
      fixture.componentRef.setInput("defaultCollectionId", "col-1");
      const mine = cipherView({
        organizationId: "org-1" as never,
        collectionIds: ["col-1"] as never,
      });
      const notMine = cipherView({
        organizationId: "org-1" as never,
        collectionIds: ["col-2"] as never,
      });

      expect(applyFilter(mine, { myItems: true })).toBe(true);
      expect(applyFilter(notMine, { myItems: true })).toBe(false);
      // Off, the toggle must not exclude anything.
      expect(applyFilter(notMine, { myItems: false })).toBe(true);
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
        // Empty, not just falsy — the chip treats only an empty string as "no reason".
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

    describe("My items", () => {
      it("is disabled with a tooltip when no cipher belongs to the My items collection", () => {
        fixture.componentRef.setInput("defaultCollectionId", "col-1");
        fixture.componentRef.setInput("ciphers", [
          cipherView({ organizationId: "org-1" as never, collectionIds: ["col-2"] as never }),
        ]);

        expect(component["noMyItems"]()).toBe(true);
        expect(component["myItemsDisabledTooltip"]()).toBe("myItemsFilterTooltip");
      });

      it("is enabled with an empty tooltip when a cipher belongs to the My items collection", () => {
        fixture.componentRef.setInput("defaultCollectionId", "col-1");
        fixture.componentRef.setInput("ciphers", [
          cipherView({ organizationId: "org-1" as never, collectionIds: ["col-1"] as never }),
        ]);

        expect(component["noMyItems"]()).toBe(false);
        expect(component["myItemsDisabledTooltip"]()).toBe("");
      });
    });

    describe("Shared folders", () => {
      it("is disabled with a tooltip when no cipher belongs to an organization", () => {
        fixture.componentRef.setInput("ciphers", [cipherView({ organizationId: undefined })]);

        expect(component["noSharedFolderOptions"]()).toBe(true);
        expect(component["sharedFolderDisabledTooltip"]()).toBe("sharedFolderFilterTooltip");
      });

      it("is disabled with a tooltip when org ciphers exist but no collections are provided", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ organizationId: "org-1" as never }),
        ]);
        fixture.componentRef.setInput("collections", []);

        expect(component["noSharedFolderOptions"]()).toBe(true);
        expect(component["sharedFolderDisabledTooltip"]()).toBe("sharedFolderFilterTooltip");
      });

      it("is enabled with an empty tooltip when org ciphers exist and collections are provided", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ organizationId: "org-1" as never }),
        ]);
        fixture.componentRef.setInput("collections", [
          { id: "col-1", name: "Engineering", organizationId: "org-1" } as CollectionView,
        ]);

        expect(component["noSharedFolderOptions"]()).toBe(false);
        // Empty, not just falsy — the chip treats only an empty string as "no reason".
        expect(component["sharedFolderDisabledTooltip"]()).toBe("");
      });
    });
  });

  describe("showMyItems", () => {
    it("shows only on an organization's All vault items page, when it has a My items collection", () => {
      fixture.componentRef.setInput("defaultCollectionId", "col-1");

      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.Organization,
        organizationId: "org-1",
      });
      expect(component["showMyItems"]()).toBe(true);

      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.Organization,
        organizationId: "org-1",
        collectionId: "col-1",
      });
      expect(component["showMyItems"]()).toBe(false);

      // Outside an organization scope.
      fixture.componentRef.setInput("scope", { type: VaultScopeType.MyVault });
      expect(component["showMyItems"]()).toBe(false);

      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.Organization,
        organizationId: "org-1",
      });
      fixture.componentRef.setInput("defaultCollectionId", undefined);
      expect(component["showMyItems"]()).toBe(false);
    });

    it("shows for an owner or admin exempt from the policy, as long as their org has a My items collection", () => {
      fixture.componentRef.setInput("orgRequiresDataOwnership", false);
      fixture.componentRef.setInput("defaultCollectionId", "col-1");
      fixture.componentRef.setInput("scope", {
        type: VaultScopeType.Organization,
        organizationId: "org-1",
      });

      expect(component["showMyItems"]()).toBe(true);
    });
  });

  describe("vaults present in the rows", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme corporation", enabled: true } as Organization,
        { id: "org-2", name: "Contoso", enabled: true } as Organization,
      ]);
    });

    describe("chip options", () => {
      it("includes all organizations regardless of which hold ciphers", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: undefined }),
          cipherView({ id: "b", organizationId: "org-2" as never }),
        ]);

        expect(component["sortedOrganizations"]().map((o) => o.id)).toEqual(["org-1", "org-2"]);
      });

      it("hides a disabled organization, and stops counting it toward the Vault chip", () => {
        fixture.componentRef.setInput("organizations", [
          { id: "org-1", name: "Acme corporation", enabled: true } as Organization,
          { id: "org-2", name: "Contoso", enabled: false } as Organization,
        ]);
        // Scoping to the enabled org suppresses the My vault option, so one vault remains.
        fixture.componentRef.setInput("scopedOrganizationId", "org-1" as never);

        expect(component["sortedOrganizations"]().map((o) => o.id)).toEqual(["org-1"]);
        expect(component["showVaults"]()).toBe(false);
      });

      it("keeps the Vault column when the only organization is disabled", () => {
        fixture.componentRef.setInput("organizations", [
          { id: "org-2", name: "Contoso", enabled: false } as Organization,
        ]);
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: "org-2" as never }),
        ]);

        // The chip has nothing to offer, but the disabled org still owns rows that need a label.
        expect(component["showVaults"]()).toBe(false);
        expect(component["showVaultColumn"]()).toBe(true);
        expect(component["visibleColumns"]()).toContain("vault");
      });

      it("offers My vault when every cipher is organization-owned but the view is unscoped", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: "org-1" as never }),
          cipherView({ id: "b", organizationId: "org-2" as never }),
        ]);

        expect(component["showMyVaultOption"]()).toBe(true);
      });

      it("offers My vault when some cipher is individually owned", () => {
        fixture.componentRef.setInput("ciphers", [
          cipherView({ id: "a", organizationId: undefined }),
          cipherView({ id: "b", organizationId: "org-1" as never }),
        ]);

        expect(component["showMyVaultOption"]()).toBe(true);
      });

      it("offers My vault when the vault is empty and not org-scoped", () => {
        fixture.componentRef.setInput("ciphers", []);

        expect(component["showMyVaultOption"]()).toBe(true);
      });

      it("omits My vault in the empty-vault fallback when scoped to an organization", () => {
        fixture.componentRef.setInput("ciphers", []);
        fixture.componentRef.setInput("scopedOrganizationId", "org-1");

        expect(component["showMyVaultOption"]()).toBe(false);
      });

      it("omits My vault in the empty-vault fallback when the org requires data ownership", () => {
        fixture.componentRef.setInput("ciphers", []);
        fixture.componentRef.setInput("orgRequiresDataOwnership", true);

        expect(component["showMyVaultOption"]()).toBe(false);
      });
    });

    describe("chip option icon tiles", () => {
      it("tints the My vault option with the user's avatar color", () => {
        expect(component["myVaultFilterTile"]()).toEqual({
          icon: "bwi-user",
          color: "#175ddc",
        });
      });

      it("gives each organization the tile its product tier earns", () => {
        fixture.componentRef.setInput("organizations", [
          {
            id: "org-1",
            name: "Acme corporation",
            enabled: true,
            productTierType: ProductTierType.Enterprise,
          } as Organization,
          {
            id: "org-2",
            name: "Contoso",
            enabled: true,
            productTierType: ProductTierType.Families,
          } as Organization,
        ]);

        const tiles = component["organizationTiles"]();

        expect(tiles.get("org-1")?.variant).toBe("purple");
        expect(tiles.get("org-2")?.variant).toBe("teal");
      });

      it("keeps the tile identity stable across reads so the filter menu is not re-dirtied", () => {
        expect(component["organizationTiles"]()).toBe(component["organizationTiles"]());
        expect(component["myVaultFilterTile"]()).toBe(component["myVaultFilterTile"]());
      });
    });

    describe("visibleColumns", () => {
      it("drops the Vault column when there is one organization and no personal vault option", () => {
        fixture.componentRef.setInput("organizations", [
          { id: "org-1", name: "Acme corporation", enabled: true } as Organization,
        ]);
        // Scoping to the org suppresses the My vault option, leaving nothing to distinguish.
        fixture.componentRef.setInput("scopedOrganizationId", "org-1" as never);

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
    it("is false when no organizations are provided, regardless of cipher ownership", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "a", organizationId: undefined }),
        cipherView({ id: "b", organizationId: undefined }),
      ]);

      expect(component["showSharedFolders"]()).toBe(false);
      expect(component["visibleColumns"]()).not.toContain("sharedFolders");
    });

    it("is true when organizations are provided", () => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme corporation", enabled: true } as Organization,
      ]);

      expect(component["showSharedFolders"]()).toBe(true);
      expect(component["visibleColumns"]()).toContain("sharedFolders");
    });

    /**
     * Unlike the vault column, the shared folders chip does not require org-owned ciphers to be
     * visible — organizations alone determine visibility, so the chip stays stable as rows filter.
     */
    it("is false when org-owned ciphers exist but no organizations are provided", () => {
      fixture.componentRef.setInput("organizations", []);
      fixture.componentRef.setInput("ciphers", [
        cipherView({ organizationId: "org-unknown" as never }),
      ]);

      expect(component["showSharedFolders"]()).toBe(false);
    });

    it("is false when no organizations are provided and there are no ciphers", () => {
      fixture.componentRef.setInput("ciphers", []);

      expect(component["showSharedFolders"]()).toBe(false);
    });
  });

  describe("resolving display names", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme corporation", enabled: true } as Organization,
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

    /** Puts the fixture in the table first, so this reads the memoized lists rather than the fallback. */
    function chipsFor(cipher: CipherView) {
      fixture.componentRef.setInput("ciphers", [cipher]);
      fixture.detectChanges();
      return {
        sharedFolders: component["sharedFolderChips"](cipher),
        folders: component["folderChips"](cipher),
      };
    }

    it("resolves shared folder chips and drops unknown ids", () => {
      const cipher = cipherView({
        organizationId: "org-1" as never,
        collectionIds: ["col-2", "col-unknown"] as never,
      });

      expect(chipsFor(cipher).sharedFolders).toEqual([
        { id: "col-2", label: "Engineering", variant: "subtle", startIcon: "bwi-shared-folder" },
      ]);
    });

    it("orders shared folder chips by name rather than by collectionIds order", () => {
      const cipher = cipherView({
        organizationId: "org-1" as never,
        // Ids whose names are reverse-alphabetical, so traversing them as given would fail this.
        collectionIds: ["col-1", "col-2"] as never,
      });

      expect(chipsFor(cipher).sharedFolders.map((chip) => chip.label)).toEqual([
        "Engineering",
        "Operations",
      ]);
    });

    it("resolves the folder as a single-entry chip list", () => {
      expect(chipsFor(cipherView({ folderId: "folder-1" as never })).folders).toEqual([
        { id: "folder-1", label: "Work", variant: "subtle", startIcon: "bwi-folder" },
      ]);
      expect(chipsFor(cipherView({ folderId: undefined })).folders).toEqual([]);
    });
  });

  describe("filtering from a membership chip", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme", enabled: true } as Organization,
      ]);
      fixture.componentRef.setInput("collections", [
        { id: "col-1", name: "Operations" } as CollectionView,
        { id: "col-2", name: "Engineering" } as CollectionView,
      ]);
      fixture.componentRef.setInput("folders", [{ id: "folder-1", name: "Work" } as FolderView]);
    });

    /** A rendered membership chip, found by the name it displays. */
    function chipButton(name: string) {
      const chip = fixture.debugElement
        .queryAll(By.css("bit-chip-group button[bit-chip-action]"))
        .find((candidate) => candidate.nativeElement.textContent.trim() === name);
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
      component["filterTo"](bitTable(), "sharedFolder", { id: "col-2", label: "Engineering" });

      expect(filterControl("sharedFolder").value()).toEqual(["col-2"]);
    });

    it("leaves the other filters untouched", () => {
      fixture.componentRef.setInput("ciphers", [cipherView({ folderId: "folder-1" as never })]);
      fixture.detectChanges();

      filterControl("search").setValue("amazon");
      filterControl("type").setValue(CipherType.Login);
      component["filterTo"](bitTable(), "folder", { id: "folder-1", label: "Work" });

      expect(filterControl("search").value()).toBe("amazon");
      expect(filterControl("type").value()).toBe(CipherType.Login);
    });

    /**
     * A chip announces only its own membership name, so the group carries the column's name to
     * say what the collection of them is.
     */
    it("names the chip group after its column", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({
          organizationId: "org-1" as never,
          collectionIds: ["col-2"] as never,
          folderId: "folder-1" as never,
        }),
      ]);
      fixture.detectChanges();

      const groups = fixture.debugElement
        .queryAll(By.css("bit-chip-group [role='group']"))
        .map((group) => group.nativeElement.getAttribute("aria-label"));

      expect(groups).toEqual(["sharedFolders", "myFolders"]);
    });
  });

  describe("multi-select chip seeding from a scalar (URL param normalization)", () => {
    // When a multi-select chip is seeded from a single URL query param, the router decodes
    // it as a scalar string rather than an array. setValue() must normalize it so the chip
    // is active and filters correctly.

    beforeEach(() => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme", enabled: true } as Organization,
        // Two orgs ensure the Vault chip renders via the multiple-vaults path.
        { id: "org-2", name: "Contoso", enabled: true } as Organization,
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
        { id: "org-1", name: "Acme corporation", enabled: true } as Organization,
        { id: "org-2", name: "Contoso", enabled: true } as Organization,
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

      expect(acme?.collections.map((c) => c.value)).toEqual([
        "col-0",
        "col-2",
        "col-4",
        "col-6",
        "col-8",
        "col-10",
      ]);
      expect(contoso?.collections.map((c) => c.value)).toEqual([
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
      expect(contoso?.collections.map((c) => c.label)).toEqual([
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

    it("builds nested shared folders recursively regardless of input order", () => {
      const parent = { id: "parent", name: "Engineering" } as CollectionView;
      const child = { id: "child", name: "Engineering/Backend" } as CollectionView;
      const grandchild = {
        id: "grandchild",
        name: "Engineering/Backend/Infrastructure",
      } as CollectionView;

      const result = component["buildNestedSharedFolders"]([grandchild, parent, child]);

      expect(result).toEqual([
        {
          value: "parent",
          label: "Engineering",
          options: [
            {
              value: "child",
              label: "Backend",
              options: [
                {
                  value: "grandchild",
                  label: "Infrastructure",
                  options: [],
                },
              ],
            },
          ],
        },
      ]);
    });

    it("keeps a nested collection's full path as its name when its parent is unavailable", () => {
      const collection = { id: "child", name: "Engineering/Backend" } as CollectionView;

      expect(component["buildNestedSharedFolders"]([collection])).toEqual([
        { value: "child", label: "Engineering/Backend", options: [] },
      ]);
    });

    it("nests a descendant under its nearest existing ancestor when an intermediate parent is unavailable", () => {
      const parent = { id: "parent", name: "Engineering" } as CollectionView;
      const descendant = {
        id: "descendant",
        name: "Engineering/Backend/Infrastructure",
      } as CollectionView;

      expect(component["buildNestedSharedFolders"]([parent, descendant])).toEqual([
        {
          value: "parent",
          label: "Engineering",
          options: [
            {
              value: "descendant",
              label: "Backend/Infrastructure",
              options: [],
            },
          ],
        },
      ]);
    });

    it("never nests collections belonging to different organizations together", () => {
      const orgAParent = {
        id: "org-a-parent",
        organizationId: "org-a",
        name: "Finance",
      } as CollectionView;
      const orgBChild = {
        id: "org-b-child",
        organizationId: "org-b",
        name: "Finance/Reports",
      } as CollectionView;

      expect(component["buildNestedSharedFolders"]([orgAParent, orgBChild])).toEqual([
        { value: "org-a-parent", label: "Finance", options: [] },
        { value: "org-b-child", label: "Finance/Reports", options: [] },
      ]);
    });

    it("returns top-level collections spanning multiple organizations in one global alphabetical order, not clustered by organization", () => {
      const zeta = { id: "zeta", organizationId: "org-a", name: "Zeta" } as CollectionView;
      const alpha = { id: "alpha", organizationId: "org-a", name: "Alpha" } as CollectionView;
      const beta = { id: "beta", organizationId: "org-b", name: "Beta" } as CollectionView;

      const result = component["buildNestedSharedFolders"]([zeta, alpha, beta]);

      expect(result.map((o) => o.value)).toEqual(["alpha", "beta", "zeta"]);
    });

    describe("rendering the nested tree", () => {
      /**
       * A shared folder option by value, read from the chip's own option tree — data-driven
       * options are plain rows, never stamped as `bit-filter-option` components.
       */
      function findOption(value: string): FilterOptionRow {
        const option = (filterMenu("sharedFolder")["allOptions"]() as FilterOptionRow[]).find(
          (o) => o.value() === value,
        );
        if (!option) {
          throw new Error(`No option found for value ${value}`);
        }
        return option;
      }

      it("nests a rendered option under its parent, flat (ungrouped) list", () => {
        fixture.componentRef.setInput("collections", [
          { id: "parent", name: "Engineering", organizationId: "org-1" } as CollectionView,
          { id: "child", name: "Engineering/Backend", organizationId: "org-1" } as CollectionView,
        ]);
        fixture.detectChanges();

        expect(component["groupSharedFolders"]()).toBe(false);
        expect(
          findOption("parent")
            .children()
            .map((c) => c.value()),
        ).toEqual(["child"]);
      });

      it("nests a rendered option under its bit-filter-section, grouped by organization", () => {
        fixture.componentRef.setInput("collections", [
          ...manyCollections(9),
          { id: "parent", name: "Engineering", organizationId: "org-1" } as CollectionView,
          { id: "child", name: "Engineering/Backend", organizationId: "org-1" } as CollectionView,
        ]);
        fixture.detectChanges();

        expect(component["groupSharedFolders"]()).toBe(true);
        const section = fixture.debugElement
          .queryAll(By.directive(FilterSectionComponent))
          .map((el) => el.componentInstance as FilterSectionComponent)
          .find((s) => s.label() === "Acme corporation");

        expect(section?.children().map((o) => o.value())).toContain("parent");
        expect(section?.children().map((o) => o.value())).not.toContain("child");
        expect(
          findOption("parent")
            .children()
            .map((c) => c.value()),
        ).toEqual(["child"]);
      });
    });
  });

  describe("nesting My folders", () => {
    it("builds nested folders recursively regardless of input order", () => {
      const parent = { id: "parent", name: "Travel" } as FolderView;
      const child = { id: "child", name: "Travel/Flights" } as FolderView;
      const grandchild = {
        id: "grandchild",
        name: "Travel/Flights/Domestic",
      } as FolderView;

      const result = component["buildNestedFolders"]([grandchild, parent, child]);

      expect(result).toEqual([
        {
          value: "parent",
          label: "Travel",
          options: [
            {
              value: "child",
              label: "Flights",
              options: [
                {
                  value: "grandchild",
                  label: "Domestic",
                  options: [],
                },
              ],
            },
          ],
        },
      ]);
    });

    it("keeps a nested folder's full path as its name when its parent is unavailable", () => {
      const folder = { id: "child", name: "Travel/Flights" } as FolderView;

      expect(component["buildNestedFolders"]([folder])).toEqual([
        { value: "child", label: "Travel/Flights", options: [] },
      ]);
    });

    it("nests a rendered option under its parent", () => {
      fixture.componentRef.setInput("folders", [
        { id: "parent", name: "Travel" } as FolderView,
        { id: "child", name: "Travel/Flights" } as FolderView,
      ]);
      fixture.detectChanges();

      const parentOption = (filterMenu("folder")["allOptions"]() as FilterOptionRow[]).find(
        (o) => o.value() === "parent",
      );

      expect(parentOption?.children().map((c) => c.value())).toEqual(["child"]);
    });
  });

  describe("sorting synthetic columns", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("organizations", [
        { id: "org-1", name: "Acme corporation", enabled: true } as Organization,
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
    /** The empty state's action button — "Clear search" or "Clear all", whichever state renders it. */
    function actionButton() {
      return fixture.debugElement.query(By.css('button[slot="button"]'));
    }

    it("explains that no items match the search term when there is data", fakeAsync(() => {
      fixture.componentRef.setInput("ciphers", [cipherView({ name: "Amazon" })]);
      fixture.detectChanges();

      // Drives the search box the table adopts automatically under the reserved `search` key.
      search("no-such-item");

      expect(fixture.nativeElement.textContent).toContain("noItemsMatchSearchTerm");
    }));

    it("explains that no items match the active chip filters", () => {
      fixture.componentRef.setInput("ciphers", [cipherView({ type: CipherType.Login })]);
      fixture.detectChanges();

      filterControl("type").setValue(CipherType.Card);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("noItemsMatchSelectedFilters");
    });

    it("relays the host's scope input to explain a genuinely empty vault", () => {
      fixture.componentRef.setInput("ciphers", []);
      fixture.componentRef.setInput("scope", { type: "myVault" });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("noItemsInMyVault");
    });

    it("clears the search term when the Clear search button is clicked", fakeAsync(() => {
      fixture.componentRef.setInput("ciphers", [cipherView({ name: "Amazon" })]);
      fixture.detectChanges();

      search("no-such-item");

      actionButton().nativeElement.click();
      fixture.detectChanges();

      expect(filterControl("search").value()).toBe("");
    }));

    it("clears chip filters when the Clear all button is clicked", () => {
      fixture.componentRef.setInput("ciphers", [cipherView({ type: CipherType.Login })]);
      fixture.detectChanges();

      filterControl("type").setValue(CipherType.Card);
      fixture.detectChanges();

      actionButton().nativeElement.click();
      fixture.detectChanges();

      expect(filterControl("type").value()).toBeUndefined();
    });

    // A truthy search term always wins the empty-state priority (see the component's
    // `emptyVaultState`), so this exercises `clearChipFilters` directly rather than through a
    // Clear all click — there is no state in which both buttons render at once.
    it("clearChipFilters leaves the search control's value untouched", () => {
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

  it("always applies the flex fill host classes", () => {
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList).toContain("tw-flex");
    expect(host.classList).toContain("tw-flex-col");
    expect(host.classList).toContain("tw-flex-1");
    expect(host.classList).toContain("tw-min-h-0");
  });

  describe("batch bar selection source", () => {
    function selectionModel() {
      const model = bitTable().selectionModel();
      if (!model) {
        throw new Error("No selection model — the table should always configure selection");
      }
      return model;
    }

    function batchBarIds(): (string | undefined)[] {
      return batchBar.selected().map((item) => item.cipher?.id as string | undefined);
    }

    it("registers a source once the view initializes", () => {
      fixture.detectChanges();

      expect(batchBar.source()).toBeDefined();
    });

    it("never selects a cipher that failed to decrypt", () => {
      const healthy = cipherView({ id: "a", name: "Amazon" });
      const failed = cipherView({ id: "b", name: "Apple ID", decryptionFailure: true });
      fixture.componentRef.setInput("ciphers", [healthy, failed]);
      fixture.detectChanges();

      // Covers select-all too: the model scopes it to the selectable rows.
      selectionModel().select(healthy, failed);
      fixture.detectChanges();

      expect(batchBarIds()).toEqual(["a"]);
    });

    it("wraps a selected cipher as a VaultItem on the batch bar", () => {
      const amazon = cipherView({ id: "a", name: "Amazon" });
      fixture.componentRef.setInput("ciphers", [amazon]);
      fixture.detectChanges();

      selectionModel().select(amazon);
      fixture.detectChanges();

      expect(batchBar.selected()).toEqual([{ cipher: amazon }]);
    });

    it("propagates every selected row, so bulk actions see the whole selection", () => {
      const rows = [
        cipherView({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Apple ID" }),
      ];
      fixture.componentRef.setInput("ciphers", rows);
      fixture.detectChanges();

      selectionModel().select(...rows);
      fixture.detectChanges();

      expect(batchBarIds()).toEqual(["a", "b"]);
    });

    it("drops a deselected row rather than accumulating", () => {
      const amazon = cipherView({ id: "a", name: "Amazon" });
      const apple = cipherView({ id: "b", name: "Apple ID" });
      fixture.componentRef.setInput("ciphers", [amazon, apple]);
      fixture.detectChanges();

      selectionModel().select(amazon, apple);
      fixture.detectChanges();
      selectionModel().deselect(amazon);
      fixture.detectChanges();

      expect(batchBarIds()).toEqual(["b"]);
    });

    it("empties the batch bar when the table's selection is cleared", () => {
      const amazon = cipherView({ id: "a", name: "Amazon" });
      fixture.componentRef.setInput("ciphers", [amazon]);
      fixture.detectChanges();

      selectionModel().select(amazon);
      fixture.detectChanges();
      selectionModel().clear();
      fixture.detectChanges();

      expect(batchBar.selected()).toEqual([]);
    });

    it("clears the table's checkboxes when the batch bar clears the source", () => {
      const amazon = cipherView({ id: "a", name: "Amazon" });
      fixture.componentRef.setInput("ciphers", [amazon]);
      fixture.detectChanges();

      selectionModel().select(amazon);
      fixture.detectChanges();
      expect(selectionModel().count()).toBe(1);

      batchBar.source()!.clear();
      fixture.detectChanges();

      expect(selectionModel().count()).toBe(0);
      expect(batchBar.selected()).toEqual([]);
    });

    // The header checkbox is a user-mutated DOM node, and Angular writes a binding only when its
    // value changes — so these assert the rendered `input`, not just the model aggregates.
    describe("header checkbox DOM", () => {
      const header = (): HTMLInputElement =>
        fixture.nativeElement.querySelector('bit-header-row input[type="checkbox"]');

      const setRows = (count: number) => {
        fixture.componentRef.setInput(
          "ciphers",
          Array.from({ length: count }, (_, i) => cipherView({ id: `c${i}`, name: `Item ${i}` })),
        );
        fixture.detectChanges();
      };

      it("unchecks when a capped select-all is cleared from the batch bar", () => {
        setRows(MAX_SELECTION_COUNT + 1);

        header().click();
        fixture.detectChanges();
        expect(selectionModel().count()).toBe(MAX_SELECTION_COUNT);

        batchBar.source()!.clear();
        fixture.detectChanges();

        expect(header().checked).toBe(false);
        expect(header().indeterminate).toBe(false);
      });

      it("checks when select-all runs from a partial selection", () => {
        setRows(6);

        const firstRow: HTMLInputElement = fixture.nativeElement.querySelector(
          "bit-row input[data-selection-input]",
        );
        firstRow.click();
        fixture.detectChanges();
        expect(header().indeterminate).toBe(true);

        header().click();
        fixture.detectChanges();

        expect(selectionModel().count()).toBe(6);
        expect(header().checked).toBe(true);
        expect(header().indeterminate).toBe(false);
      });
    });

    it("keeps the batch bar in agreement after rows are re-emitted", () => {
      fixture.componentRef.setInput("ciphers", [cipherView({ id: "a", name: "Amazon" })]);
      fixture.detectChanges();

      selectionModel().select(bitTable().filtered()[0]);
      fixture.detectChanges();
      expect(batchBarIds()).toEqual(["a"]);

      // A fresh decrypt of the same cipher — a new reference carrying the same id.
      fixture.componentRef.setInput("ciphers", [cipherView({ id: "a", name: "Amazon" })]);
      fixture.detectChanges();

      const selectedRows = selectionModel().selected();
      expect(batchBar.selected()).toEqual(selectedRows.map((cipher) => ({ cipher })));
      expect(batchBarIds()).toEqual(["a"]);
    });

    it("re-points the selection at the new row objects when rows are re-emitted", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Apple ID" }),
      ]);
      fixture.detectChanges();

      selectionModel().select(bitTable().filtered()[0]);
      fixture.detectChanges();

      // A background sync hands the table all-new references for the same ciphers.
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Apple ID" }),
      ]);
      fixture.detectChanges();

      // Without reconciliation the selection holds detached objects: the checkbox reads unchecked
      // while the bar still reports the row.
      const row = bitTable().filtered()[0];
      expect(selectionModel().isSelected(row)).toBe(true);
      expect(batchBarIds()).toEqual(["a"]);
    });

    it("drops a selected row that is gone after a re-emit", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Apple ID" }),
      ]);
      fixture.detectChanges();

      selectionModel().select(...bitTable().filtered());
      fixture.detectChanges();
      expect(batchBarIds()).toEqual(["a", "b"]);

      // "Amazon" was deleted elsewhere, so the sync re-emits without it.
      fixture.componentRef.setInput("ciphers", [cipherView({ id: "b", name: "Apple ID" })]);
      fixture.detectChanges();

      expect(batchBarIds()).toEqual(["b"]);
    });

    it("does not clear a new selection on subsequent renders", () => {
      const amazon = cipherView({ id: "a", name: "Amazon" });
      fixture.componentRef.setInput("ciphers", [amazon]);
      fixture.detectChanges();

      selectionModel().select(amazon);
      fixture.detectChanges();
      fixture.detectChanges();

      expect(selectionModel().count()).toBe(1);
      expect(batchBarIds()).toEqual(["a"]);
    });

    it("selects only the rows surviving the active filter when select-all is used", () => {
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "a", name: "Amazon", type: CipherType.Login }),
        cipherView({ id: "b", name: "Visa", type: CipherType.Card }),
      ]);
      fixture.detectChanges();

      filterControl("type").setValue(CipherType.Card);
      fixture.detectChanges();

      selectionModel().toggleAll();
      fixture.detectChanges();

      expect(batchBarIds()).toEqual(["b"]);
    });

    it("caps the selection itself at MAX_SELECTION_COUNT", () => {
      const many = Array.from({ length: MAX_SELECTION_COUNT + 25 }, (_, i) =>
        cipherView({ id: `cipher-${i}`, name: `Item ${String(i).padStart(4, "0")}` }),
      );
      fixture.componentRef.setInput("ciphers", many);
      fixture.detectChanges();

      selectionModel().toggleAll();
      fixture.detectChanges();

      expect(selectionModel().count()).toBe(MAX_SELECTION_COUNT);
      expect(batchBar.selected().length).toBe(MAX_SELECTION_COUNT);
    });

    it("reports a partial header when the cap stops select-all short", () => {
      const many = Array.from({ length: MAX_SELECTION_COUNT + 25 }, (_, i) =>
        cipherView({ id: `cipher-${i}`, name: `Item ${String(i).padStart(4, "0")}` }),
      );
      fixture.componentRef.setInput("ciphers", many);
      fixture.detectChanges();

      selectionModel().toggleAll();
      fixture.detectChanges();

      expect(selectionModel().allSelected()).toBe(false);
      expect(selectionModel().indeterminate()).toBe(true);
    });

    it("clears from the partial header at the cap", () => {
      const many = Array.from({ length: MAX_SELECTION_COUNT + 25 }, (_, i) =>
        cipherView({ id: `cipher-${i}`, name: `Item ${String(i).padStart(4, "0")}` }),
      );
      fixture.componentRef.setInput("ciphers", many);
      fixture.detectChanges();

      selectionModel().toggleAll();
      fixture.detectChanges();
      selectionModel().toggleAll();
      fixture.detectChanges();

      expect(selectionModel().count()).toBe(0);
    });

    it("caps in display order when the sort is reversed", () => {
      const many = Array.from({ length: MAX_SELECTION_COUNT + 25 }, (_, i) =>
        cipherView({ id: `cipher-${i}`, name: `Item ${String(i).padStart(4, "0")}` }),
      );
      fixture.componentRef.setInput("ciphers", many);
      fixture.detectChanges();

      bitTable().sort.set({ column: "name", direction: "desc" });
      fixture.detectChanges();

      selectionModel().toggleAll();
      fixture.detectChanges();

      const expected = [...many]
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, MAX_SELECTION_COUNT)
        .map((cipher) => cipher.id);
      expect(
        selectionModel()
          .selected()
          .map((cipher) => cipher.id)
          .sort(),
      ).toEqual(expected.sort());
    });

    it("clears a capped select-all on the next toggle", () => {
      const many = Array.from({ length: MAX_SELECTION_COUNT + 25 }, (_, i) =>
        cipherView({ id: `cipher-${i}`, name: `Item ${String(i).padStart(4, "0")}` }),
      );
      fixture.componentRef.setInput("ciphers", many);
      fixture.detectChanges();

      selectionModel().toggleAll();
      fixture.detectChanges();
      selectionModel().toggleAll();
      fixture.detectChanges();

      expect(selectionModel().count()).toBe(0);
      expect(batchBar.selected().length).toBe(0);
    });

    it("disables unselected row checkboxes once the selection is full", () => {
      // A cap small enough that a rejected row lands inside the virtual-scroll window.
      (component as unknown as { selection: SelectionConfig<CipherViewLike> }).selection = {
        multiple: true,
        max: 2,
      };
      fixture.componentRef.setInput(
        "ciphers",
        Array.from({ length: 4 }, (_, i) => cipherView({ id: `cipher-${i}`, name: `Item ${i}` })),
      );
      fixture.detectChanges();

      const boxes = () =>
        fixture.debugElement
          .queryAll(By.css("input[data-selection-input]"))
          .map((d) => d.nativeElement as HTMLInputElement);

      boxes()[0].click();
      fixture.detectChanges();
      boxes()[1].click();
      fixture.detectChanges();
      expect(selectionModel().count()).toBe(2);

      expect(boxes()[2].disabled).toBe(true);
      expect(boxes()[3].disabled).toBe(true);
      expect(boxes()[0].disabled).toBe(false);
      expect(boxes()[1].disabled).toBe(false);

      boxes()[0].click();
      fixture.detectChanges();
      expect(boxes()[2].disabled).toBe(false);
    });

    it("omits the header select-all in single-select mode", () => {
      (component as unknown as { selection: SelectionConfig<CipherViewLike> }).selection = {
        multiple: false,
      };
      fixture.componentRef.setInput("ciphers", [
        cipherView({ id: "a", name: "Amazon" }),
        cipherView({ id: "b", name: "Apple ID" }),
      ]);
      fixture.detectChanges();

      const all = fixture.debugElement.queryAll(By.css("input[type=checkbox]"));
      const rowBoxes = fixture.debugElement.queryAll(By.css("input[data-selection-input]"));

      expect(rowBoxes.length).toBe(2);
      expect(all.length).toBe(rowBoxes.length);
    });

    it("holds a bottom margin only while the bar is showing", () => {
      const amazon = cipherView({ id: "a", name: "Amazon" });
      fixture.componentRef.setInput("ciphers", [amazon]);
      fixture.detectChanges();

      const host = () => fixture.nativeElement as HTMLElement;

      expect(host().style.marginBottom).toBe("0px");

      selectionModel().select(amazon);
      fixture.detectChanges();

      // Assert space is held rather than the figure, which BULK_BAR_CLEARANCE is free to tune.
      expect(parseInt(host().style.marginBottom, 10)).toBeGreaterThan(0);

      selectionModel().clear();
      fixture.detectChanges();

      expect(host().style.marginBottom).toBe("0px");
    });

    it("deregisters its source when the table is destroyed", () => {
      fixture.detectChanges();
      expect(batchBar.source()).toBeDefined();

      fixture.destroy();

      expect(batchBar.source()).toBeUndefined();
    });
  });
});
