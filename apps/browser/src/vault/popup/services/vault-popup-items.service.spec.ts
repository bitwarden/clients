import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, take, timeout } from "rxjs";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { mockAccountServiceWith, ObservableTracker } from "@bitwarden/common/spec";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { LocalData } from "@bitwarden/common/vault/models/data/local.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { InlineMenuFieldQualificationService } from "../../../autofill/services/inline-menu-field-qualification.service";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopupViewCacheService } from "../../../platform/popup/view-cache/popup-view-cache.service";
import { PopupCipherViewLike } from "../views/popup-cipher.view";

import { VaultPopupAutofillService } from "./vault-popup-autofill.service";
import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupListFiltersService } from "./vault-popup-list-filters.service";

describe("VaultPopupItemsService", () => {
  let testBed: TestBed;
  let service: VaultPopupItemsService;
  let allCiphers: Record<CipherId, CipherView>;
  let autoFillCiphers: CipherView[];

  let mockOrg: Organization;
  let mockCollections: CollectionView[];
  let activeUserLastSync$: BehaviorSubject<Date | null>;
  let cipherList$: BehaviorSubject<CipherView[]>;
  let viewCacheService: {
    signal: jest.Mock;
    mockSignal: WritableSignal<string | null>;
  };

  let ciphersSubject: BehaviorSubject<Record<CipherId, CipherData>>;
  let localDataSubject: BehaviorSubject<Record<CipherId, LocalData>>;
  let failedToDecryptCiphersSubject: BehaviorSubject<CipherView[]>;

  const cipherServiceMock = mock<CipherService>();
  const vaultSettingsServiceMock = mock<VaultSettingsService>();
  const organizationServiceMock = mock<OrganizationService>();
  const vaultPopupListFiltersServiceMock = mock<VaultPopupListFiltersService>();
  const searchService = mock<SearchService>();
  const collectionService = mock<CollectionService>();
  const vaultAutofillServiceMock = mock<VaultPopupAutofillService>();
  const syncServiceMock = mock<SyncService>();
  const inlineMenuFieldQualificationServiceMock = mock<InlineMenuFieldQualificationService>();
  const userId = Utils.newGuid() as UserId;
  const accountServiceMock = mockAccountServiceWith(userId);
  const configServiceMock = mock<ConfigService>();
  const cipherArchiveServiceMock = mock<CipherArchiveService>();
  cipherArchiveServiceMock.userCanArchive$.mockReturnValue(of(true));

  const restrictedItemTypesService = {
    restricted$: new BehaviorSubject<RestrictedCipherType[]>([]),
    isCipherRestricted: jest.fn().mockReturnValue(false),
  };

  beforeEach(() => {
    allCiphers = cipherFactory(10);
    const cipherList = Object.values(allCiphers);
    // First 2 ciphers are autofill
    autoFillCiphers = cipherList.slice(0, 2);

    // First autofill cipher is also favorite
    autoFillCiphers[0].favorite = true;

    // 3rd and 4th ciphers are favorite
    cipherList[2].favorite = true;
    cipherList[3].favorite = true;

    cipherList$ = new BehaviorSubject<CipherView[]>(cipherList);

    cipherServiceMock.cipherListViews$.mockReturnValue(cipherList$.asObservable());

    ciphersSubject = new BehaviorSubject<Record<CipherId, CipherData>>({});
    localDataSubject = new BehaviorSubject<Record<CipherId, LocalData>>({});
    failedToDecryptCiphersSubject = new BehaviorSubject<CipherView[]>([]);

    cipherServiceMock.ciphers$.mockImplementation((userId: UserId) =>
      ciphersSubject.asObservable(),
    );
    cipherServiceMock.localData$.mockImplementation((userId: UserId) =>
      localDataSubject.asObservable(),
    );
    cipherServiceMock.failedToDecryptCiphers$.mockImplementation((userId: UserId) =>
      failedToDecryptCiphersSubject.asObservable(),
    );

    searchService.searchCiphers.mockImplementation(async (userId, _, __, ciphers) => ciphers!);
    cipherServiceMock.filterCiphersForUrl.mockImplementation(async (ciphers) =>
      ciphers.filter((c) => ["0", "1"].includes(uuidAsString(c.id))),
    );
    vaultSettingsServiceMock.showCardsCurrentTab$ = new BehaviorSubject(false);
    vaultSettingsServiceMock.showIdentitiesCurrentTab$ = new BehaviorSubject(false);

    vaultPopupListFiltersServiceMock.filters$ = new BehaviorSubject({
      organization: null,
      collection: null,
      cipherType: null,
      folder: null,
    });
    // Return all ciphers, `filterFunction$` will be tested in `VaultPopupListFiltersService`
    vaultPopupListFiltersServiceMock.filterFunction$ = new BehaviorSubject(
      (ciphers: PopupCipherViewLike[]) => ciphers,
    );

    vaultAutofillServiceMock.currentAutofillTab$ = new BehaviorSubject({
      url: "https://example.com",
    } as chrome.tabs.Tab);

    vaultAutofillServiceMock.nonLoginCipherTypesOnPage$ = new BehaviorSubject({
      [CipherType.Card]: true,
      [CipherType.Identity]: true,
    });

    mockOrg = {
      id: "org1",
      name: "Organization 1",
      productTierType: ProductTierType.Enterprise,
    } as Organization;

    mockCollections = [
      { id: "col1", name: "Collection 1" } as CollectionView,
      { id: "col2", name: "Collection 2" } as CollectionView,
    ];

    organizationServiceMock.organizations$.mockReturnValue(new BehaviorSubject([mockOrg]));
    collectionService.decryptedCollections$.mockReturnValue(new BehaviorSubject(mockCollections));

    activeUserLastSync$ = new BehaviorSubject<Date | null>(new Date());
    syncServiceMock.activeUserLastSync$.mockReturnValue(activeUserLastSync$);
    configServiceMock.getFeatureFlag$.mockReturnValue(of(true));

    const testSearchSignal = createMockSignal<string | null>("");
    viewCacheService = {
      mockSignal: testSearchSignal,
      signal: jest.fn((options) => testSearchSignal),
    };

    testBed = TestBed.configureTestingModule({
      providers: [
        { provide: CipherService, useValue: cipherServiceMock },
        { provide: VaultSettingsService, useValue: vaultSettingsServiceMock },
        { provide: SearchService, useValue: searchService },
        { provide: OrganizationService, useValue: organizationServiceMock },
        { provide: AccountService, useValue: accountServiceMock },
        { provide: VaultPopupListFiltersService, useValue: vaultPopupListFiltersServiceMock },
        { provide: CollectionService, useValue: collectionService },
        { provide: VaultPopupAutofillService, useValue: vaultAutofillServiceMock },
        { provide: SyncService, useValue: syncServiceMock },
        { provide: AccountService, useValue: mockAccountServiceWith("UserId" as UserId) },
        {
          provide: InlineMenuFieldQualificationService,
          useValue: inlineMenuFieldQualificationServiceMock,
        },
        { provide: PopupViewCacheService, useValue: viewCacheService },
        { provide: ConfigService, useValue: configServiceMock },
        {
          provide: RestrictedItemTypesService,
          useValue: restrictedItemTypesService,
        },
        {
          provide: CipherArchiveService,
          useValue: cipherArchiveServiceMock,
        },
      ],
    });

    service = testBed.inject(VaultPopupItemsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be created", () => {
    service = testBed.inject(VaultPopupItemsService);
    expect(service).toBeTruthy();
  });

  it("should merge cipher views with collections and organization", (done) => {
    const cipherList = Object.values(allCiphers);
    cipherList[0].organizationId = "org1";
    cipherList[0].collectionIds = ["col1", "col2"];

    service.autoFillCiphers$.subscribe((ciphers) => {
      expect(ciphers[0].organization).toEqual(mockOrg);
      expect(ciphers[0].collections).toContain(mockCollections[0]);
      expect(ciphers[0].collections).toContain(mockCollections[1]);
      done();
    });
  });

  it("should not re-emit autoFillCiphers$ when cipherService.ciphers$ emits but the resulting list is unchanged", async () => {
    const tracker = new ObservableTracker(service.autoFillCiphers$);

    // Initial emission
    await tracker.expectEmission();
    const initial = tracker.emissions[0];

    // Trigger a ciphers$ emission that doesn't actually change the final list
    ciphersSubject.next({});

    // Ensure we do NOT get a second emission
    await expect(tracker.pauseUntilReceived(2)).rejects.toThrow("Timeout exceeded");
    expect(tracker.emissions.length).toBe(1);

    // Sanity check: still the same array of ciphers
    expect(tracker.emissions[0]).toBe(initial);
  });

  it("should not re-emit autoFillCiphers$ when cipherService.localData$ emits  but the resulting list is unchanged", async () => {
    const tracker = new ObservableTracker(service.autoFillCiphers$);

    // Initial emission
    await tracker.expectEmission();
    const initial = tracker.emissions[0];

    // Trigger a localData$ emission that doesn't actually change the final list
    localDataSubject.next({});

    // Ensure we do NOT get a second emission
    await expect(tracker.pauseUntilReceived(2)).rejects.toThrow("Timeout exceeded");
    expect(tracker.emissions.length).toBe(1);

    // Sanity check: still the same array of ciphers
    expect(tracker.emissions[0]).toBe(initial);
  });

  it("should not emit cipher list if syncService.getLastSync returns null", async () => {
    activeUserLastSync$.next(null);

    const obs$ = service.autoFillCiphers$.pipe(timeout(50));

    await expect(firstValueFrom(obs$)).rejects.toThrow("Timeout has occurred");
  });

  describe("autoFillCiphers$", () => {
    it("should return empty array if there is no current tab", (done) => {
      (vaultAutofillServiceMock.currentAutofillTab$ as BehaviorSubject<any>).next(null);
      service.autoFillCiphers$.subscribe((ciphers) => {
        expect(ciphers).toEqual([]);
        done();
      });
    });

    it("should filter ciphers for the current tab and types", (done) => {
      const currentTab = { url: "https://example.com" } as chrome.tabs.Tab;

      (vaultSettingsServiceMock.showCardsCurrentTab$ as BehaviorSubject<boolean>).next(true);
      (vaultSettingsServiceMock.showIdentitiesCurrentTab$ as BehaviorSubject<boolean>).next(true);
      jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(currentTab);

      service.autoFillCiphers$.subscribe((ciphers) => {
        expect(cipherServiceMock.filterCiphersForUrl.mock.calls.length).toBe(1);
        expect(cipherServiceMock.filterCiphersForUrl).toHaveBeenCalledWith(
          expect.anything(),
          currentTab.url,
          [CipherType.Card, CipherType.Identity],
        );
        done();
      });
    });

    it("should return ciphers sorted by type, then by last used date, then by name", (done) => {
      const expectedTypeOrder: Record<CipherType, number> = {
        [CipherType.Login]: 1,
        [CipherType.Card]: 2,
        [CipherType.Identity]: 3,
        [CipherType.SecureNote]: 4,
        [CipherType.SshKey]: 5,
      };

      // Assume all ciphers are autofill ciphers to test sorting
      cipherServiceMock.filterCiphersForUrl.mockImplementation(async () =>
        Object.values(allCiphers),
      );

      service.autoFillCiphers$.subscribe((ciphers) => {
        expect(ciphers.length).toBe(10);

        for (let i = 0; i < ciphers.length - 1; i++) {
          const current = ciphers[i];
          const next = ciphers[i + 1];

          expect(expectedTypeOrder[CipherViewLikeUtils.getType(current)]).toBeLessThanOrEqual(
            expectedTypeOrder[CipherViewLikeUtils.getType(next)],
          );
        }
        expect(cipherServiceMock.sortCiphersByLastUsedThenName).toHaveBeenCalled();
        done();
      });
    });

    it("should filter autoFillCiphers$ down to search term", (done) => {
      const searchText = "Login";

      searchService.searchCiphers.mockImplementation(async (userId, q, _, ciphers) => {
        return ciphers!.filter((cipher) => {
          return cipher.name.includes(searchText);
        });
      });

      // there is only 1 Login returned for filteredCiphers.
      service.autoFillCiphers$.subscribe((ciphers) => {
        expect(ciphers[0].name.includes(searchText)).toBe(true);
        expect(ciphers.length).toBe(1);
        done();
      });
    });
  });

  describe("favoriteCiphers$", () => {
    it("should exclude autofill ciphers", (done) => {
      service.favoriteCiphers$.subscribe((ciphers) => {
        // 2 autofill ciphers, 3 favorite ciphers, 1 favorite cipher is also autofill = 2 favorite ciphers to show
        expect(ciphers.length).toBe(2);
        done();
      });
    });

    it("should filter favoriteCiphers$ down to search term", (done) => {
      const cipherList = Object.values(allCiphers);
      const searchText = "Card 2";

      searchService.searchCiphers.mockImplementation(async () => {
        return cipherList.filter((cipher) => {
          return cipher.name === searchText;
        });
      });

      service.favoriteCiphers$.subscribe((ciphers) => {
        // There are 2 favorite items but only one Card 2
        expect(ciphers[0].name).toBe(searchText);
        expect(ciphers.length).toBe(1);
        done();
      });
    });
  });

  describe("remainingCiphers$", () => {
    beforeEach(() => {
      searchService.isSearchable.mockImplementation(async (text) => text.length > 2);
    });

    it("should re-emit remainingCiphers$ when a cipher object changes, even if the list and ids are the same", async () => {
      const tracker = new ObservableTracker(service.remainingCiphers$);

      await tracker.expectEmission();
      const initial = tracker.emissions[0];

      const [changedId] = initial.map((c: PopupCipherViewLike) => c.id);
      const updated = cipherList$.value.map((c) =>
        c.id === changedId
          ? ({
              ...c,
              name: `${c.name} (updated)`,
            } as CipherView)
          : c,
      );

      cipherList$.next(updated);
      ciphersSubject.next({});

      await tracker.expectEmission();
      expect(tracker.emissions.length).toBe(2);

      const [before, after] = tracker.emissions;
      expect(before).not.toBe(after);
      expect(after.find((c: PopupCipherViewLike) => c.id === changedId)?.name).toContain(
        "(updated)",
      );
    });

    it("should re-emit remainingCiphers$ when only the order of ciphers changes", async () => {
      const tracker = new ObservableTracker(service.remainingCiphers$);

      await tracker.expectEmission();

      const reordered = [...cipherList$.value].reverse();
      cipherList$.next(reordered);
      ciphersSubject.next({});

      await tracker.expectEmission();
      expect(tracker.emissions.length).toBe(2);

      const [before, after] = tracker.emissions;
      expect(before).not.toBe(after);
      expect(before.map((c: PopupCipherViewLike) => c.id).reverse()).toEqual(
        after.map((c: PopupCipherViewLike) => c.id),
      );
    });
  });

  describe("emptyVault$", () => {
    it("should return true if there are no ciphers", (done) => {
      cipherServiceMock.cipherListViews$.mockReturnValue(of([]));
      service.emptyVault$.pipe(take(1)).subscribe((empty) => {
        expect(empty).toBe(true);
        done();
      });
    });

    it("should return false if there are ciphers", (done) => {
      cipherServiceMock.cipherListViews$.mockReturnValue(
        of([{ id: "1", type: CipherType.Login, name: "Login 1" }] as CipherView[]),
      );

      service.emptyVault$.pipe(take(1)).subscribe((empty) => {
        expect(empty).toBe(false);
        done();
      });
    });

    it("should return true when all ciphers are deleted/archived", (done) => {
      cipherServiceMock.cipherListViews$.mockReturnValue(
        of([
          { id: "1", type: CipherType.Login, name: "Login 1", isDeleted: true },
          { id: "2", type: CipherType.Login, name: "Login 2", isDeleted: true },
          { id: "3", type: CipherType.Login, name: "Login 3", isDeleted: false, isArchived: true },
        ] as CipherView[]),
      );

      service.emptyVault$.pipe(take(1)).subscribe((empty) => {
        expect(empty).toBe(true);
        done();
      });
    });
  });

  describe("noFilteredResults$", () => {
    it("should return false when filteredResults has values", (done) => {
      service.noFilteredResults$.subscribe((noResults) => {
        expect(noResults).toBe(false);
        done();
      });
    });

    it("should return true when there are zero filteredResults", (done) => {
      searchService.searchCiphers.mockImplementation(async () => []);
      service.noFilteredResults$.subscribe((noResults) => {
        expect(noResults).toBe(true);
        done();
      });
    });
  });

  describe("deletedCiphers$", () => {
    it("should return deleted ciphers", async () => {
      const deletedCipher = new CipherView();
      deletedCipher.deletedDate = new Date();
      const ciphers = [new CipherView(), new CipherView(), new CipherView(), deletedCipher];

      cipherServiceMock.cipherListViews$.mockReturnValue(of(ciphers));
      ciphersSubject.next({});

      const deletedCiphers = await firstValueFrom(service.deletedCiphers$);
      expect(deletedCiphers.length).toBe(1);
    });
  });

  describe("hasFilterApplied$", () => {
    it("should return true if the search term provided is searchable", (done) => {
      searchService.isSearchable.mockImplementation(async () => true);
      service.hasFilterApplied$.subscribe((canSearch) => {
        expect(canSearch).toBe(true);
        done();
      });
    });

    it("should return false if the search term provided is not searchable", (done) => {
      searchService.isSearchable.mockImplementation(async () => false);
      service.hasFilterApplied$.subscribe((canSearch) => {
        expect(canSearch).toBe(false);
        done();
      });
    });
  });

  describe("loading$", () => {
    let tracked: ObservableTracker<boolean>;
    beforeEach(() => {
      // Start tracking loading$ emissions
      tracked = new ObservableTracker(service.loading$);
    });

    it("should initialize with true first", async () => {
      expect(tracked.emissions[0]).toBe(true);
    });

    it("should emit false once ciphers are available", async () => {
      await tracked.pauseUntilReceived(2);

      expect(tracked.emissions[0]).toBe(true);
      expect(tracked.emissions[1]).toBe(false);
    });

    it("should cycle when cipherService.ciphers$ emits even if cipher lists don't re-emit", async () => {
      await tracked.pauseUntilReceived(2);

      const before = [...tracked.emissions];

      ciphersSubject.next({});

      await tracked.pauseUntilReceived(before.length + 2);

      const after = tracked.emissions;

      expect(after.length).toBeGreaterThan(before.length);

      const tail = after.slice(before.length);
      expect(tail[0]).toBe(true);
      expect(tail[1]).toBe(false);
    });
  });

  describe("applyFilter", () => {
    it("should call search Service with the new search term", (done) => {
      const searchText = "Hello";
      const searchServiceSpy = jest.spyOn(searchService, "searchCiphers");

      service.applyFilter(searchText);
      service.favoriteCiphers$.subscribe(() => {
        expect(searchServiceSpy).toHaveBeenCalledWith(
          "UserId",
          searchText,
          undefined,
          expect.anything(),
        );
        done();
      });
    });
  });

  it("should update searchText$ when applyFilter is called", (done) => {
    service.searchText$.subscribe((val) => {
      expect(val).toEqual("test search");
      expect(viewCacheService.mockSignal()).toEqual("test search");
      done();
    });

    service.applyFilter("test search");
  });
});

// A function to generate a list of ciphers of different types
function cipherFactory(count: number): Record<CipherId, CipherView> {
  const ciphers: CipherView[] = [];
  for (let i = 0; i < count; i++) {
    const type = ((i % 4) + 1) as CipherType;
    switch (type) {
      case CipherType.Login:
        ciphers.push({
          id: `${i}`,
          type: CipherType.Login,
          name: `Login ${i}`,
          login: {
            username: `username${i}`,
            password: `password${i}`,
          },
        } as CipherView);
        break;
      case CipherType.SecureNote:
        ciphers.push({
          id: `${i}`,
          type: CipherType.SecureNote,
          name: `SecureNote ${i}`,
          notes: `notes${i}`,
        } as CipherView);
        break;
      case CipherType.Card:
        ciphers.push({
          id: `${i}`,
          type: CipherType.Card,
          name: `Card ${i}`,
          card: {
            cardholderName: `cardholderName${i}`,
            number: `number${i}`,
            brand: `brand${i}`,
          },
        } as CipherView);
        break;
      case CipherType.Identity:
        ciphers.push({
          id: `${i}`,
          type: CipherType.Identity,
          name: `Identity ${i}`,
          identity: {
            firstName: `firstName${i}`,
            lastName: `lastName${i}`,
          },
        } as CipherView);
        break;
    }
  }
  return Object.fromEntries(ciphers.map((c) => [c.id, c]));
}

function createMockSignal<T>(initialValue: T): WritableSignal<T> {
  const s = signal(initialValue);
  s.set = (value: T) => s.update(() => value);
  return s;
}
