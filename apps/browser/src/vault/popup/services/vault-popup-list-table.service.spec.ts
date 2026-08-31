import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService } from "@bitwarden/components";
import { DecryptionFailureDialogComponent, PasswordRepromptService } from "@bitwarden/vault";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopupCipherViewLike } from "../views/popup-cipher.view";

import { VaultPopupAutofillService } from "./vault-popup-autofill.service";
import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupListTableService } from "./vault-popup-list-table.service";
import { VaultPopupLoadingService } from "./vault-popup-loading.service";

describe("VaultPopupListTableService", () => {
  let service: VaultPopupListTableService;
  let cipherService: MockProxy<CipherService>;
  let vaultPopupAutofillService: MockProxy<VaultPopupAutofillService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let router: MockProxy<Router>;

  const autoFillCiphers$ = new BehaviorSubject<PopupCipherViewLike[]>([]);
  const favoriteCiphers$ = new BehaviorSubject<PopupCipherViewLike[]>([]);
  const filteredCiphers$ = new BehaviorSubject<PopupCipherViewLike[]>([]);
  const hasSearchText$ = new BehaviorSubject<boolean>(false);
  const searchText$ = new BehaviorSubject<string>("");
  const loading$ = new BehaviorSubject<boolean>(false);
  const applyFilter = jest.fn();

  // Inputs to the per-row action policy (feature flag, blocklist, click-to-autofill setting).
  const simplifiedItemActionEnabled$ = new BehaviorSubject<boolean>(false);
  const currentTabIsOnBlocklist$ = new BehaviorSubject<boolean>(false);
  const clickItemsToAutofillVaultView$ = new BehaviorSubject<boolean>(true);

  const makeCipher = (overrides: Partial<PopupCipherViewLike> = {}): PopupCipherViewLike =>
    ({ id: "cipher-1", name: "Item", type: CipherType.Login, ...overrides }) as PopupCipherViewLike;

  beforeEach(() => {
    jest.clearAllMocks();
    autoFillCiphers$.next([]);
    favoriteCiphers$.next([]);
    filteredCiphers$.next([]);
    hasSearchText$.next(false);
    searchText$.next("");
    loading$.next(false);
    simplifiedItemActionEnabled$.next(false);
    currentTabIsOnBlocklist$.next(false);
    clickItemsToAutofillVaultView$.next(true);

    cipherService = mock<CipherService>();
    vaultPopupAutofillService = mock<VaultPopupAutofillService>();
    vaultPopupAutofillService.currentTabIsOnBlocklist$ = currentTabIsOnBlocklist$.asObservable();
    passwordRepromptService = mock<PasswordRepromptService>();
    router = mock<Router>();

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as any);

    const configService = {
      getFeatureFlag$: jest
        .fn()
        .mockImplementation((flag: FeatureFlag) =>
          flag === FeatureFlag.PM31039ItemActionInExtension
            ? simplifiedItemActionEnabled$.asObservable()
            : of(false),
        ),
    };

    TestBed.configureTestingModule({
      providers: [
        VaultPopupListTableService,
        {
          provide: VaultPopupItemsService,
          useValue: {
            autoFillCiphers$: autoFillCiphers$.asObservable(),
            favoriteCiphers$: favoriteCiphers$.asObservable(),
            filteredCiphers$: filteredCiphers$.asObservable(),
            hasSearchText$: hasSearchText$.asObservable(),
            searchText$: searchText$.asObservable(),
            applyFilter,
          },
        },
        {
          provide: VaultPopupLoadingService,
          useValue: { loading$: loading$.asObservable() },
        },
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: accountService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: Router, useValue: router },
        { provide: VaultPopupAutofillService, useValue: vaultPopupAutofillService },
        { provide: ConfigService, useValue: configService },
        {
          provide: VaultSettingsService,
          useValue: {
            clickItemsToAutofillVaultView$: clickItemsToAutofillVaultView$.asObservable(),
          },
        },
      ],
    });

    service = TestBed.inject(VaultPopupListTableService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("rows$", () => {
    it("merges autofill, favorites, and all-items sections in order when not searching", async () => {
      autoFillCiphers$.next([makeCipher({ id: "a", name: "Autofill" })]);
      favoriteCiphers$.next([makeCipher({ id: "f", name: "Favorite" })]);
      filteredCiphers$.next([makeCipher({ id: "i", name: "All Items" })]);

      const rows = await firstValueFrom(service.rows$);

      expect(rows.map((r) => r._section)).toEqual(["autofill", "favorites", "allItems"]);
      expect(rows.map((r) => r.cipher.name)).toEqual(["Autofill", "Favorite", "All Items"]);
    });

    it("folds to a single all-items section of filtered ciphers when searching", async () => {
      autoFillCiphers$.next([makeCipher({ id: "a", name: "Autofill" })]);
      favoriteCiphers$.next([makeCipher({ id: "f", name: "Favorite" })]);
      filteredCiphers$.next([
        makeCipher({ id: "m1", name: "Match 1" }),
        makeCipher({ id: "m2", name: "Match 2" }),
      ]);
      hasSearchText$.next(true);

      const rows = await firstValueFrom(service.rows$);

      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r._section === "allItems")).toBe(true);
      expect(rows.map((r) => r.cipher.name)).toEqual(["Match 1", "Match 2"]);
    });

    it("is empty when there are no ciphers", async () => {
      expect(await firstValueFrom(service.rows$)).toEqual([]);
    });

    it("tags rows without mutating the source ciphers", async () => {
      const original = makeCipher({ id: "i", name: "All Items" });
      filteredCiphers$.next([original]);

      const rows = await firstValueFrom(service.rows$);

      expect((original as unknown as { _section?: string })._section).toBeUndefined();
      expect(rows[0]._section).toBe("allItems");
    });
  });

  describe("row actions", () => {
    // The action context streams seed themselves with `startWith`, so `rows$` emits a seeded value
    // before settling. Read the latest synchronous emission (as `toSignal` does), not the first.
    const latestRows = () => {
      let latest: any[] = [];
      service.rows$.subscribe((rows) => (latest = rows)).unsubscribe();
      return latest;
    };
    const autofillRow = () => {
      autoFillCiphers$.next([makeCipher({ id: "a" })]);
      return latestRows()[0].actions;
    };
    const sectionRow = (section: "favorites" | "allItems") => {
      (section === "favorites" ? favoriteCiphers$ : filteredCiphers$).next([
        makeCipher({ id: section }),
      ]);
      return latestRows().find((r) => r._section === section)!.actions;
    };

    describe("simplified item action (feature flag on)", () => {
      beforeEach(() => {
        simplifiedItemActionEnabled$.next(true);
        currentTabIsOnBlocklist$.next(false);
      });

      it("fills autofill-section rows on click and offers View (not Autofill) in the menu", async () => {
        expect(autofillRow()).toMatchObject({
          primaryAutofill: true,
          showFillOnHover: true,
          showLaunch: false,
          showAutofillInMenu: false,
          showViewInMenu: true,
          showAutofillBadge: false,
        });
      });

      it("views favorites/all-items rows on click and offers Autofill (not View) in the menu", async () => {
        expect(sectionRow("favorites")).toMatchObject({
          primaryAutofill: false,
          showFillOnHover: false,
          showLaunch: true,
          showAutofillInMenu: true,
          showViewInMenu: false,
        });
      });

      it("never fills on click when the current URI is blocked", async () => {
        currentTabIsOnBlocklist$.next(true);
        expect(autofillRow()).toMatchObject({ primaryAutofill: false, showFillOnHover: false });
      });
    });

    describe("legacy autofill affordance (feature flag off)", () => {
      beforeEach(() => {
        simplifiedItemActionEnabled$.next(false);
      });

      it("shows the Fill chip on autofill rows when click-to-autofill is off and the URI isn't blocked", async () => {
        clickItemsToAutofillVaultView$.next(false);
        expect(autofillRow()).toMatchObject({ showAutofillBadge: true, primaryAutofill: false });
        expect(sectionRow("favorites")).toMatchObject({ showAutofillBadge: false });
      });

      it("hides the Fill chip and fills on click when click-to-autofill is on", async () => {
        clickItemsToAutofillVaultView$.next(true);
        expect(autofillRow()).toMatchObject({ showAutofillBadge: false, primaryAutofill: true });
      });

      it("hides the Fill chip and never autofills when the URI is blocked", async () => {
        clickItemsToAutofillVaultView$.next(false);
        currentTabIsOnBlocklist$.next(true);
        expect(autofillRow()).toMatchObject({ showAutofillBadge: false, primaryAutofill: false });
      });

      it("offers Autofill in the menu for non-autofill rows only", async () => {
        expect(autofillRow()).toMatchObject({ showAutofillInMenu: false });
        expect(sectionRow("favorites")).toMatchObject({ showAutofillInMenu: true });
      });
    });

    describe("titleKey", () => {
      it("uses the autofill title (named field when a username is present) for fill-on-click rows", async () => {
        simplifiedItemActionEnabled$.next(true);
        jest.spyOn(CipherViewLikeUtils, "getLogin").mockReturnValue({ username: "user" } as any);
        expect(autofillRow().titleKey).toBe("autofillTitleWithField");
      });

      it("uses the view title for view-on-click rows without a username field", async () => {
        jest.spyOn(CipherViewLikeUtils, "getLogin").mockReturnValue({ username: null } as any);
        expect(sectionRow("allItems").titleKey).toBe("viewItemTitle");
      });
    });
  });

  describe("hasSearchText$", () => {
    it("passes through the items service value", async () => {
      hasSearchText$.next(true);
      expect(await firstValueFrom(service.hasSearchText$)).toBe(true);
    });
  });

  describe("applyFilterOnInput", () => {
    it("applies the search term to the vault after the debounce interval", fakeAsync(() => {
      const input$ = new Subject<string>();
      const sub = service.applyFilterOnInput(input$).subscribe();

      input$.next("git");
      expect(applyFilter).not.toHaveBeenCalled();

      tick(SearchTextDebounceInterval);
      expect(applyFilter).toHaveBeenCalledWith("git");

      sub.unsubscribe();
    }));

    it("applies immediately (no debounce) while the vault is loading", fakeAsync(() => {
      loading$.next(true);
      const input$ = new Subject<string>();
      const sub = service.applyFilterOnInput(input$).subscribe();

      input$.next("git");
      tick(0);
      expect(applyFilter).toHaveBeenCalledWith("git");

      sub.unsubscribe();
    }));
  });

  describe("doAutofill", () => {
    it("autofills a full CipherView directly", async () => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
      const cipher = makeCipher();

      await service.doAutofill(cipher);

      expect(vaultPopupAutofillService.doAutofill).toHaveBeenCalledWith(cipher);
      expect(cipherService.cipherView$).not.toHaveBeenCalled();
    });

    it("fetches the full cipher view before autofilling a CipherListView", async () => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(true);
      const fullView = makeCipher({ id: "full" });
      cipherService.cipherView$.mockReturnValue(of(fullView as any));

      await service.doAutofill(makeCipher());

      expect(vaultPopupAutofillService.doAutofill).toHaveBeenCalledWith(fullView);
    });

    it("does not autofill when the full cipher view cannot be resolved", async () => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(true);
      cipherService.cipherView$.mockReturnValue(of(null as any));

      await service.doAutofill(makeCipher());

      expect(vaultPopupAutofillService.doAutofill).not.toHaveBeenCalled();
    });
  });

  describe("viewCipher", () => {
    beforeEach(() => {
      // Navigate immediately (no double-click launch delay) unless a test overrides it.
      jest.spyOn(CipherViewLikeUtils, "canLaunch").mockReturnValue(false);
    });

    it("navigates to view-cipher when the password reprompt passes", fakeAsync(() => {
      jest.spyOn(CipherViewLikeUtils, "decryptionFailure").mockReturnValue(false);
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);

      void service.viewCipher(makeCipher({ id: "c1", type: CipherType.Login }));
      tick();

      expect(router.navigate).toHaveBeenCalledWith(["/view-cipher"], {
        queryParams: { cipherId: "c1", type: CipherType.Login },
      });
    }));

    it("does not navigate when the password reprompt fails", fakeAsync(() => {
      jest.spyOn(CipherViewLikeUtils, "decryptionFailure").mockReturnValue(false);
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);

      void service.viewCipher(makeCipher());
      tick();

      expect(router.navigate).not.toHaveBeenCalled();
    }));

    it("opens the decryption-failure dialog and skips navigation on decryption failure", fakeAsync(() => {
      jest.spyOn(CipherViewLikeUtils, "decryptionFailure").mockReturnValue(true);
      const openSpy = jest
        .spyOn(DecryptionFailureDialogComponent, "open")
        .mockReturnValue({} as any);

      void service.viewCipher(makeCipher({ id: "c1" }));
      tick();

      expect(openSpy).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    }));

    it("ignores a second view request while one is already pending", fakeAsync(() => {
      jest.spyOn(CipherViewLikeUtils, "decryptionFailure").mockReturnValue(false);
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);

      void service.viewCipher(makeCipher({ id: "first" }));
      void service.viewCipher(makeCipher({ id: "second" }));
      tick();

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(["/view-cipher"], {
        queryParams: { cipherId: "first", type: CipherType.Login },
      });
    }));
  });

  describe("launchCipher", () => {
    it("does nothing when the cipher cannot launch", async () => {
      jest.spyOn(CipherViewLikeUtils, "canLaunch").mockReturnValue(false);
      jest.spyOn(CipherViewLikeUtils, "getLaunchUri").mockReturnValue(undefined);

      await service.launchCipher(makeCipher());

      expect(cipherService.updateLastLaunchedDate).not.toHaveBeenCalled();
    });

    it("updates the last-launched date and opens a new tab", async () => {
      jest.spyOn(CipherViewLikeUtils, "canLaunch").mockReturnValue(true);
      jest.spyOn(CipherViewLikeUtils, "getLaunchUri").mockReturnValue("https://example.com");
      const newTab = jest.spyOn(BrowserApi, "createNewTab").mockResolvedValue({} as any);
      jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(false);

      await service.launchCipher(makeCipher({ id: "c1" }));

      expect(cipherService.updateLastLaunchedDate).toHaveBeenCalledWith("c1", "user-1");
      expect(newTab).toHaveBeenCalledWith("https://example.com");
    });
  });
});
