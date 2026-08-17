import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
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
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import { CompactModeService, DialogService, ToastService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import { PasswordRepromptService, VaultCopyButtonsService } from "@bitwarden/vault";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
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
    applyFilter: jest.fn(),
  };

  const vaultPopupLoadingService = {
    loading$: loading$.asObservable(),
  };

  const vaultPopupSectionService = {
    getOpenDisplayStateForSection: jest.fn().mockReturnValue(() => true),
    updateSectionOpenStoredState: jest.fn(),
  };

  const compactModeEnabled$ = new BehaviorSubject<boolean>(false);
  const compactModeService = {
    enabled$: compactModeEnabled$.asObservable(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    featureFlag$.next(false);
    currentTabIsOnBlocklist$.next(false);
    autoFillCiphers$.next([]);
    favoriteCiphers$.next([]);
    filteredCiphers$.next([]);
    loading$.next(false);
    searchText$.next("");
    hasSearchText$.next(false);
    compactModeEnabled$.next(false);
    clickItemsToAutofillVaultView$.next(true);

    await TestBed.configureTestingModule({
      imports: [VaultPopupListTableComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: WINDOW, useValue: window },
        { provide: ConfigService, useValue: configService },
        { provide: VaultPopupAutofillService, useValue: vaultPopupAutofillService },
        { provide: VaultPopupItemsService, useValue: vaultPopupItemsService },
        { provide: VaultPopupLoadingService, useValue: vaultPopupLoadingService },
        { provide: VaultPopupSectionService, useValue: vaultPopupSectionService },
        { provide: CompactModeService, useValue: compactModeService },
        { provide: I18nService, useValue: mock<I18nService>({ t: (k: string) => k }) },
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
