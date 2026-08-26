import { LiveAnnouncer } from "@angular/cdk/a11y";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import {
  ChipFilterOption,
  CompactModeService,
  DialogService,
  FilterMenuComponent,
  FilterSectionComponent,
  ToastService,
} from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import { PasswordRepromptService, VaultCopyButtonsService } from "@bitwarden/vault";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
import { VaultPopupListTableFiltersService } from "../../../services/vault-popup-list-table-filters.service";
import { VaultPopupLoadingService } from "../../../services/vault-popup-loading.service";
import { VaultPopupSectionService } from "../../../services/vault-popup-section.service";
import { PopupCipherViewLike } from "../../../views/popup-cipher.view";

import { VaultPopupListTableComponent } from "./vault-popup-list-table.component";

const makeCipher = (overrides: Partial<PopupCipherViewLike> = {}): PopupCipherViewLike =>
  ({
    id: "cipher-1",
    name: "Test Login",
    type: CipherType.Login,
    login: { username: "user@example.com", uris: [] },
    favorite: false,
    reprompt: 0,
    organizationId: null,
    collectionIds: [],
    edit: true,
    viewPassword: true,
    collections: [],
    ...overrides,
  }) as any;

// A section-tagged row. `actions` is irrelevant to the section/type predicates under test here
// (they read only `_section`/`type`); the resolved actions are covered in the service spec.
const makeRow = (
  section: "autofill" | "favorites" | "allItems",
  overrides: Partial<PopupCipherViewLike> = {},
) => ({ cipher: makeCipher(overrides), _section: section, actions: {} }) as any;

describe("VaultPopupListTableComponent", () => {
  let fixture: ComponentFixture<VaultPopupListTableComponent>;
  let component: VaultPopupListTableComponent;

  const featureFlag$ = new BehaviorSubject<boolean>(false);
  const currentTabIsOnBlocklist$ = new BehaviorSubject<boolean>(false);
  const autoFillCiphers$ = new BehaviorSubject<PopupCipherViewLike[]>([]);
  const favoriteCiphers$ = new BehaviorSubject<PopupCipherViewLike[]>([]);
  const filteredCiphers$ = new BehaviorSubject<PopupCipherViewLike[]>([]);
  const loading$ = new BehaviorSubject<boolean>(false);
  const searchText$ = new BehaviorSubject<string>("");
  const hasSearchText$ = new BehaviorSubject<boolean>(false);
  const showDeactivatedOrg$ = new BehaviorSubject<boolean>(false);
  const liveAnnouncer = mock<LiveAnnouncer>();
  const clickItemsToAutofillVaultView$ = new BehaviorSubject<boolean>(true);

  const configService = {
    getFeatureFlag$: jest.fn().mockImplementation((flag: FeatureFlag) => {
      if (flag === FeatureFlag.PM31039ItemActionInExtension) {
        return featureFlag$.asObservable();
      }
      return of(false);
    }),
  };

  const vaultPopupAutofillService = {
    currentTabIsOnBlocklist$: currentTabIsOnBlocklist$.asObservable(),
    doAutofill: jest.fn(),
  };

  const vaultPopupItemsService = {
    autoFillCiphers$: autoFillCiphers$.asObservable(),
    favoriteCiphers$: favoriteCiphers$.asObservable(),
    filteredCiphers$: filteredCiphers$.asObservable(),
    loading$: loading$.asObservable(),
    searchText$: searchText$.asObservable(),
    hasSearchText$: hasSearchText$.asObservable(),
    showDeactivatedOrg$: showDeactivatedOrg$.asObservable(),
    applyFilter: jest.fn(),
  };

  const vaultPopupLoadingService = {
    loading$: loading$.asObservable(),
  };

  const vaultPopupSectionService = {
    getOpenDisplayStateForSection: jest.fn().mockReturnValue(() => true),
    updateSectionOpenStoredState: jest.fn(),
  };

  const cipherTypes$ = new BehaviorSubject<ChipFilterOption<CipherType>[]>([]);
  const organizations$ = new BehaviorSubject<ChipFilterOption<Organization>[]>([]);
  const collections$ = new BehaviorSubject<ChipFilterOption<CollectionView>[]>([]);
  const folders$ = new BehaviorSubject<ChipFilterOption<FolderView>[]>([]);

  const vaultPopupListTableFiltersService = {
    restoreFilters$: jest.fn().mockReturnValue(of({})),
    saveFilters: jest.fn(),
    selectedOrganizations: signal<Organization[]>([]),
    cipherTypes$: cipherTypes$.asObservable(),
    organizations$: organizations$.asObservable(),
    collections$: collections$.asObservable(),
    folders$: folders$.asObservable(),
  };

  const compactModeEnabled$ = new BehaviorSubject<boolean>(false);
  const compactModeService = {
    enabled$: compactModeEnabled$.asObservable(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // `clearAllMocks` resets calls but not implementations, so restore the default open state.
    vaultPopupSectionService.getOpenDisplayStateForSection.mockReturnValue(() => true);
    featureFlag$.next(false);
    currentTabIsOnBlocklist$.next(false);
    autoFillCiphers$.next([]);
    favoriteCiphers$.next([]);
    filteredCiphers$.next([]);
    loading$.next(false);
    searchText$.next("");
    hasSearchText$.next(false);
    showDeactivatedOrg$.next(false);
    compactModeEnabled$.next(false);
    cipherTypes$.next([]);
    organizations$.next([]);
    collections$.next([]);
    folders$.next([]);
    clickItemsToAutofillVaultView$.next(true);
    liveAnnouncer.announce.mockClear();

    await TestBed.configureTestingModule({
      imports: [VaultPopupListTableComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: WINDOW, useValue: window },
        { provide: ConfigService, useValue: configService },
        { provide: VaultPopupAutofillService, useValue: vaultPopupAutofillService },
        { provide: VaultPopupItemsService, useValue: vaultPopupItemsService },
        { provide: VaultPopupLoadingService, useValue: vaultPopupLoadingService },
        { provide: VaultPopupSectionService, useValue: vaultPopupSectionService },
        {
          provide: VaultPopupListTableFiltersService,
          useValue: vaultPopupListTableFiltersService,
        },
        { provide: CompactModeService, useValue: compactModeService },
        { provide: I18nService, useValue: mock<I18nService>({ t: (k: string) => k }) },
        { provide: LiveAnnouncer, useValue: liveAnnouncer },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "test-user-id" }) } },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        // Providers for the child components rendered in each row (vault-icon, copy actions,
        // more-options menu), mirroring the Storybook setup.
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
        { provide: VaultCopyButtonsService, useValue: { showQuickCopyActions$: of(false) } },
        {
          provide: StateProvider,
          useValue: {
            getUserState$: () => of({ hasSeen: true, hasDismissed: true }),
            getUser: () => ({ update: async () => {} }),
          },
        },
        { provide: RestrictedItemTypesService, useValue: { restricted$: of([]) } },
        {
          provide: VaultSettingsService,
          useValue: {
            clickItemsToAutofillVaultView$: clickItemsToAutofillVaultView$.asObservable(),
          },
        },
        {
          provide: PlatformUtilsService,
          useValue: { getAutofillKeyboardShortcut: async () => "" },
        },
        { provide: ToastService, useValue: {} },
        { provide: OrganizationService, useValue: { hasOrganizations: () => of(false) } },
        {
          provide: CipherAuthorizationService,
          useValue: { canDeleteCipher$: () => of(false), canCloneCipher$: () => of(false) },
        },
        { provide: CollectionService, useValue: { decryptedCollections$: () => of([]) } },
        { provide: CipherArchiveService, useValue: { userCanArchive$: () => of(false) } },
        { provide: EventCollectionService, useValue: {} },
        { provide: TotpService, useValue: {} },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: () => of(true) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultPopupListTableComponent);
    component = fixture.componentInstance;
  });

  describe("collapsible sections", () => {
    const headerToggle = (label: string): HTMLButtonElement | undefined =>
      Array.from(fixture.nativeElement.querySelectorAll("button[aria-expanded]")).find((button) =>
        (button as HTMLButtonElement).textContent?.includes(label),
      ) as HTMLButtonElement | undefined;

    /**
     * The table virtualizes its rows into a `height="fill"` viewport, which measures 0 in JSDOM and
     * renders nothing — so the host needs a real height before the group headers exist to click.
     */
    const render = async () => {
      favoriteCiphers$.next([makeCipher({ id: "fav-1", favorite: true })]);
      filteredCiphers$.next([makeCipher({ id: "all-1" })]);
      fixture.nativeElement.style.height = "600px";
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it("persists the collapsed state when the user collapses a section", async () => {
      await render();

      const toggle = headerToggle("favorites");
      expect(toggle).toBeDefined();
      expect(toggle!.getAttribute("aria-expanded")).toBe("true");

      toggle!.click();
      fixture.detectChanges();

      expect(vaultPopupSectionService.updateSectionOpenStoredState).toHaveBeenCalledWith(
        "favorites",
        false,
      );
      expect(headerToggle("favorites")!.getAttribute("aria-expanded")).toBe("false");
    });

    it("persists the expanded state when the user re-expands a section", async () => {
      // Seeded before the first render rather than by rebuilding the fixture: a second live
      // fixture fights the first over the scroll host.
      vaultPopupSectionService.getOpenDisplayStateForSection.mockReturnValue(() => false);
      await render();

      const toggle = headerToggle("favorites");
      expect(toggle!.getAttribute("aria-expanded")).toBe("false");

      toggle!.click();
      fixture.detectChanges();

      expect(vaultPopupSectionService.updateSectionOpenStoredState).toHaveBeenCalledWith(
        "favorites",
        true,
      );
    });
  });

  /**
   * Rows are filtered upstream, so the table's own `noMatches()` heuristic can't tell a zero-result
   * search from an empty vault — both leave it with zero rows. The empty state is projected for
   * that reason, so these assert the rendered copy.
   */
  describe("empty state", () => {
    it("shows the search-specific copy and recovery hint when a search matches nothing", () => {
      hasSearchText$.next(true);
      filteredCiphers$.next([]);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain("noItemsMatchSearch");
      expect(text).toContain("clearFiltersOrTryAnother");
    });

    it("shows the generic copy with no recovery hint when there is simply nothing to show", () => {
      hasSearchText$.next(false);
      filteredCiphers$.next([]);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain("nothingToShow");
      expect(text).not.toContain("noItemsMatchSearch");
      expect(text).not.toContain("clearFiltersOrTryAnother");
    });

    describe("deactivated organization", () => {
      beforeEach(() => {
        // First render so toObservable(showDeactivatedOrg) consumes the initial false via skip(1).
        // Tests can then observe the transition to true when selectedOrgs is set below.
        fixture.detectChanges();
        filteredCiphers$.next([makeCipher({ organizationId: "org-1" })]);
        component["selectedOrgs"].set([{ enabled: false, id: "org-1" } as Organization]);
        fixture.detectChanges();
      });

      it("withholds the rows and shows the deactivated notice", () => {
        expect(component["rows"]()).toEqual([]);

        const text = fixture.nativeElement.textContent;
        expect(text).toContain("organizationIsDeactivated");
        expect(text).toContain("contactYourOrgAdmin");
        expect(text).not.toContain("nothingToShow");
      });

      it("keeps the toolbar mounted so the filter stays clearable", () => {
        expect(fixture.nativeElement.querySelector("bit-table-toolbar")).not.toBeNull();
        expect(fixture.nativeElement.querySelector("bit-search")).not.toBeNull();
      });

      it("restores the rows once the filter moves off the suspended organization", () => {
        component["selectedOrgs"].set([]);
        fixture.detectChanges();

        expect(component["rows"]()).toHaveLength(1);
        expect(fixture.nativeElement.textContent).not.toContain("organizationIsDeactivated");
      });

      it("announces the notice", () => {
        expect(liveAnnouncer.announce).toHaveBeenCalledWith(
          "organizationIsDeactivated contactYourOrgAdmin",
          "polite",
        );
      });

      it("does not announce again when the filter moves off the suspended organization", () => {
        liveAnnouncer.announce.mockClear();

        component["selectedOrgs"].set([]);
        fixture.detectChanges();

        expect(liveAnnouncer.announce).not.toHaveBeenCalled();
      });
    });
  });

  describe("group predicates", () => {
    it("isAutofill returns true only for autofill-tagged rows", () => {
      const row = makeRow("autofill");
      expect(component["isAutofill"](row)).toBe(true);
      expect(component["isFavorites"](row)).toBe(false);
      expect(component["isAllItems"](row)).toBe(false);
    });

    it("isFavorites returns true only for favorites-tagged rows", () => {
      const row = makeRow("favorites");
      expect(component["isAutofill"](row)).toBe(false);
      expect(component["isFavorites"](row)).toBe(true);
      expect(component["isAllItems"](row)).toBe(false);
    });

    it("isAllItems returns true only for allItems-tagged rows", () => {
      const row = makeRow("allItems");
      expect(component["isAutofill"](row)).toBe(false);
      expect(component["isFavorites"](row)).toBe(false);
      expect(component["isAllItems"](row)).toBe(true);
    });
  });

  describe("type subgroup predicates", () => {
    it("isCard returns true for Card ciphers", () => {
      const row = makeRow("autofill", { type: CipherType.Card });
      expect(component["isCard"](row)).toBe(true);
      expect(component["isIdentity"](row)).toBe(false);
    });

    it("isIdentity returns true for Identity ciphers", () => {
      const row = makeRow("autofill", { type: CipherType.Identity });
      expect(component["isCard"](row)).toBe(false);
      expect(component["isIdentity"](row)).toBe(true);
    });
  });

  describe("filter chips", () => {
    const chipFor = (key: string) =>
      fixture.debugElement
        .queryAll(By.directive(FilterMenuComponent))
        .find((chip) => chip.componentInstance.key() === key)?.componentInstance;

    it("renders a chip per filter, omitting those whose options are empty", () => {
      cipherTypes$.next([{ value: CipherType.Login, label: "Login" }]);
      fixture.detectChanges();

      // Type is unconditional; the other three are hidden while their option streams are empty.
      expect(chipFor("cipherType")).toBeDefined();
      expect(chipFor("organization")).toBeUndefined();
      expect(chipFor("collection")).toBeUndefined();
      expect(chipFor("folder")).toBeUndefined();

      organizations$.next([{ value: { id: "org-1" } as Organization, label: "Org 1" }]);
      fixture.detectChanges();

      expect(chipFor("organization")).toBeDefined();
    });

    it("flattens nested folder options into one option per node", () => {
      const parent = { id: "f-1", name: "Parent" } as FolderView;
      const child = { id: "f-2", name: "Parent/Child" } as FolderView;
      folders$.next([
        { value: parent, label: "Parent", children: [{ value: child, label: "Child" }] },
      ]);
      fixture.detectChanges();

      expect(component["folderOptions"]().map((o) => o.value)).toEqual([parent, child]);
    });

    it("keeps each nested option's own label, which may repeat across branches", () => {
      // "Work/Personal" and "Home/Personal" both nest to a node labeled "Personal"; options are
      // tracked by id, so the repeat is expected rather than a defect.
      folders$.next([
        {
          value: { id: "f-1", name: "Work" } as FolderView,
          label: "Work",
          children: [
            { value: { id: "f-2", name: "Work/Personal" } as FolderView, label: "Personal" },
          ],
        },
        {
          value: { id: "f-3", name: "Home" } as FolderView,
          label: "Home",
          children: [
            { value: { id: "f-4", name: "Home/Personal" } as FolderView, label: "Personal" },
          ],
        },
      ]);
      fixture.detectChanges();

      const options = component["folderOptions"]();
      expect(options.map((o) => o.label)).toEqual(["Work", "Personal", "Home", "Personal"]);
      expect(new Set(options.map((o) => o.value.id)).size).toBe(4);
    });

    describe("collection org grouping", () => {
      const col1 = {
        id: "col-1",
        name: "Alpha",
        organizationId: "org-1",
      } as unknown as CollectionView;
      const col2 = {
        id: "col-2",
        name: "Beta",
        organizationId: "org-1",
      } as unknown as CollectionView;
      const col3 = {
        id: "col-3",
        name: "Gamma",
        organizationId: "org-2",
      } as unknown as CollectionView;

      it("does not group when all collections belong to one organization", () => {
        collections$.next([
          { value: col1, label: "Alpha" },
          { value: col2, label: "Beta" },
        ]);
        fixture.detectChanges();

        expect(component["groupCollectionsByOrg"]()).toBe(false);
      });

      it("groups when collections belong to multiple organizations", () => {
        collections$.next([
          { value: col1, label: "Alpha" },
          { value: col3, label: "Gamma" },
        ]);
        fixture.detectChanges();

        expect(component["groupCollectionsByOrg"]()).toBe(true);
      });

      it("places each collection under its owning organization", () => {
        organizations$.next([
          { value: { id: "org-1" } as Organization, label: "Acme" },
          { value: { id: "org-2" } as Organization, label: "Zeta" },
        ]);
        collections$.next([
          { value: col1, label: "Alpha" },
          { value: col3, label: "Gamma" },
        ]);
        fixture.detectChanges();

        const groups = component["collectionsByOrg"]();
        expect(groups).toHaveLength(2);
        expect(groups[0]).toMatchObject({ name: "Acme", collections: [{ value: col1 }] });
        expect(groups[1]).toMatchObject({ name: "Zeta", collections: [{ value: col3 }] });
      });

      it("sorts groups alphabetically by organization name", () => {
        organizations$.next([
          { value: { id: "org-2" } as Organization, label: "Zeta" },
          { value: { id: "org-1" } as Organization, label: "Acme" },
        ]);
        collections$.next([
          { value: col3, label: "Gamma" },
          { value: col1, label: "Alpha" },
        ]);
        fixture.detectChanges();

        expect(component["collectionsByOrg"]().map((g) => g.name)).toEqual(["Acme", "Zeta"]);
      });

      it("renders a flat option list when there is only one organization", () => {
        collections$.next([
          { value: col1, label: "Alpha" },
          { value: col2, label: "Beta" },
        ]);
        fixture.detectChanges();

        expect(fixture.debugElement.queryAll(By.directive(FilterSectionComponent))).toHaveLength(0);
      });

      it("renders one collapsible section per organization when there are multiple", () => {
        organizations$.next([
          { value: { id: "org-1" } as Organization, label: "Acme" },
          { value: { id: "org-2" } as Organization, label: "Zeta" },
        ]);
        collections$.next([
          { value: col1, label: "Alpha" },
          { value: col3, label: "Gamma" },
        ]);
        fixture.detectChanges();

        expect(fixture.debugElement.queryAll(By.directive(FilterSectionComponent))).toHaveLength(2);
      });
    });
  });

  describe("search", () => {
    it("syncs searchText from the search text already applied to the vault", () => {
      searchText$.next("synced text");
      fixture.detectChanges();

      expect(component["searchText"]).toBe("synced text");
    });

    it("applies the search filter (debounced) when the search text changes", fakeAsync(() => {
      component["searchText"] = "foo";
      component.onSearchTextChanged();
      tick(SearchTextDebounceInterval);

      expect(vaultPopupItemsService.applyFilter).toHaveBeenCalledWith("foo");
    }));
  });

  describe("loading state", () => {
    it("reflects loading$ from vaultPopupLoadingService", () => {
      loading$.next(true);
      fixture.detectChanges();

      expect(component["loading"]()).toBe(true);
    });

    it("reflects non-loading state", () => {
      loading$.next(false);
      fixture.detectChanges();

      expect(component["loading"]()).toBe(false);
    });
  });

  describe("itemHeight", () => {
    it("returns 59 in normal mode", () => {
      compactModeEnabled$.next(false);
      fixture.detectChanges();
      expect(component["itemHeight"]()).toBe(59);
    });

    it("returns 53 in compact mode", () => {
      compactModeEnabled$.next(true);
      fixture.detectChanges();
      expect(component["itemHeight"]()).toBe(53);
    });
  });

  describe("onCipherSelect", () => {
    it("autofills rows whose resolved action is fill-on-click", () => {
      const doAutofill = jest
        .spyOn(component["listTableService"], "doAutofill")
        .mockResolvedValue();
      const viewCipher = jest
        .spyOn(component["listTableService"], "viewCipher")
        .mockResolvedValue();

      const row = { cipher: makeCipher(), actions: { primaryAutofill: true } } as any;
      void component.onCipherSelect(row);

      expect(doAutofill).toHaveBeenCalledWith(row.cipher);
      expect(viewCipher).not.toHaveBeenCalled();
    });

    it("navigates to view for rows whose resolved action is view-on-click", () => {
      const doAutofill = jest
        .spyOn(component["listTableService"], "doAutofill")
        .mockResolvedValue();
      const viewCipher = jest
        .spyOn(component["listTableService"], "viewCipher")
        .mockResolvedValue();

      const row = { cipher: makeCipher(), actions: { primaryAutofill: false } } as any;
      void component.onCipherSelect(row);

      expect(viewCipher).toHaveBeenCalledWith(row.cipher);
      expect(doAutofill).not.toHaveBeenCalled();
    });
  });
});
