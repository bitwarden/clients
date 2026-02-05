import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed, fakeAsync, flush, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Observable, Subject, of } from "rxjs";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { NudgeType, NudgesService } from "@bitwarden/angular/vault";
import {
  AutoConfirmExtensionSetupDialogComponent,
  AutomaticUserConfirmationService,
} from "@bitwarden/auto-confirm";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import AutofillService from "@bitwarden/browser/autofill/services/autofill.service";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupRouterCacheService } from "@bitwarden/browser/platform/popup/view-cache/popup-router-cache.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { TaskService } from "@bitwarden/common/vault/tasks";
import { DialogService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import {
  DecryptionFailureDialogComponent,
  VaultItemsTransferService,
  DefaultVaultItemsTransferService,
} from "@bitwarden/vault";

import { BrowserApi } from "../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../platform/browser/browser-popup-utils";
import { IntroCarouselService } from "../../services/intro-carousel.service";
import { VaultPopupAutofillService } from "../../services/vault-popup-autofill.service";
import { VaultPopupCopyButtonsService } from "../../services/vault-popup-copy-buttons.service";
import { VaultPopupItemsService } from "../../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../../services/vault-popup-list-filters.service";
import { VaultPopupLoadingService } from "../../services/vault-popup-loading.service";
import { VaultPopupScrollPositionService } from "../../services/vault-popup-scroll-position.service";
import { AtRiskPasswordCalloutComponent } from "../at-risk-callout/at-risk-password-callout.component";

import { AutofillVaultListItemsComponent } from "./autofill-vault-list-items/autofill-vault-list-items.component";
import { BlockedInjectionBanner } from "./blocked-injection-banner/blocked-injection-banner.component";
import { NewItemDropdownV2Component } from "./new-item-dropdown/new-item-dropdown-v2.component";
import { VaultHeaderV2Component } from "./vault-header/vault-header-v2.component";
import { VaultListItemsContainerComponent } from "./vault-list-items-container/vault-list-items-container.component";
import { VaultV2Component } from "./vault-v2.component";

@Component({
  selector: "popup-header",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopupHeaderStubComponent {
  readonly pageTitle = input("");
}

@Component({
  selector: "app-vault-header-v2",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultHeaderV2StubComponent {}

@Component({
  selector: "app-current-account",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CurrentAccountStubComponent {}

@Component({
  selector: "app-new-item-dropdown",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NewItemDropdownStubComponent {
  readonly initialValues = input();
}

@Component({
  selector: "app-pop-out",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PopOutStubComponent {}

@Component({
  selector: "blocked-injection-banner",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class BlockedInjectionBannerStubComponent {}

@Component({
  selector: "vault-at-risk-password-callout",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class VaultAtRiskCalloutStubComponent {}

@Component({
  selector: "app-autofill-vault-list-items",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class AutofillVaultListItemsStubComponent {}

@Component({
  selector: "app-vault-list-items-container",
  standalone: true,
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class VaultListItemsContainerStubComponent {
  readonly title = input<string>();
  readonly ciphers = input<any[]>();
  readonly id = input<string>();
  readonly disableSectionMargin = input<boolean>();
  readonly collapsibleKey = input<string>();
}

const mockDialogRef = {
  close: jest.fn(),
  afterClosed: jest.fn().mockReturnValue(of(undefined)),
  closed: of(undefined),
} as unknown as import("@bitwarden/components").DialogRef<any, any>;

jest
  .spyOn(PremiumUpgradeDialogComponent, "open")
  .mockImplementation((_: DialogService) => mockDialogRef as any);

jest
  .spyOn(DecryptionFailureDialogComponent, "open")
  .mockImplementation((_: DialogService, _params: any) => mockDialogRef as any);

const autoConfirmDialogSpy = jest
  .spyOn(AutoConfirmExtensionSetupDialogComponent, "open")
  .mockImplementation((_: DialogService) => mockDialogRef as any);

jest.spyOn(BrowserApi, "isPopupOpen").mockResolvedValue(false);
jest.spyOn(BrowserPopupUtils, "openCurrentPagePopout").mockResolvedValue();

describe("VaultV2Component", () => {
  let component: VaultV2Component;

  interface FakeAccount {
    id: string;
  }

  function queryAllSpotlights(fixture: any): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("bit-spotlight")) as HTMLElement[];
  }

  const itemsSvc: any = {
    emptyVault$: new BehaviorSubject<boolean>(false),
    noFilteredResults$: new BehaviorSubject<boolean>(false),
    showDeactivatedOrg$: new BehaviorSubject<boolean>(false),
    favoriteCiphers$: new BehaviorSubject<any[]>([]),
    remainingCiphers$: new BehaviorSubject<any[]>([]),
    filteredCiphers$: new BehaviorSubject<any[]>([]),
    cipherCount$: new BehaviorSubject<number>(0),
    hasSearchText$: new BehaviorSubject<boolean>(false),
  } as Partial<VaultPopupItemsService>;

  const filtersSvc: any = {
    allFilters$: new Subject<any>(),
    filters$: new BehaviorSubject<any>({}),
    filterVisibilityState$: new BehaviorSubject<any>({}),
    numberOfAppliedFilters$: new BehaviorSubject<number>(0),
  };

  const loadingSvc: any = {
    loading$: new BehaviorSubject<boolean>(false),
  };

  const activeAccount$ = new BehaviorSubject<FakeAccount | null>({ id: "user-1" });

  const cipherSvc = {
    failedToDecryptCiphers$: jest.fn().mockReturnValue(of([])),
  } as Partial<CipherService>;

  const nudgesSvc = {
    showNudgeSpotlight$: jest.fn().mockImplementation((_type: NudgeType) => of(false)),
    dismissNudge: jest.fn().mockResolvedValue(undefined),
  };

  const dialogSvc = {} as Partial<DialogService>;

  const introSvc = {
    setIntroCarouselDismissed: jest.fn().mockResolvedValue(undefined),
  } as Partial<IntroCarouselService>;

  const scrollSvc = {
    start: jest.fn(),
    stop: jest.fn(),
  } as Partial<VaultPopupScrollPositionService>;

  const vaultItemsTransferSvc = {
    transferInProgress$: new BehaviorSubject<boolean>(false),
    enforceOrganizationDataOwnership: jest.fn().mockResolvedValue(undefined),
  } as Partial<VaultItemsTransferService>;

  function getObs<T = unknown>(cmp: any, key: string): Observable<T> {
    return cmp[key] as Observable<T>;
  }

  const hasPremiumFromAnySource$ = new BehaviorSubject<boolean>(false);

  const billingSvc = {
    hasPremiumFromAnySource$: (_: string) => hasPremiumFromAnySource$,
  };

  const configSvc = {
    getFeatureFlag$: jest.fn().mockImplementation((_flag: string) => of(false)),
  };

  const autoConfirmSvc = {
    configuration$: jest.fn().mockReturnValue(of({})),
    canManageAutoConfirm$: jest.fn().mockReturnValue(of(false)),
    upsert: jest.fn().mockResolvedValue(undefined),
    autoConfirmUser: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [VaultV2Component, RouterTestingModule],
      providers: [
        provideNoopAnimations(),
        { provide: VaultPopupItemsService, useValue: itemsSvc },
        { provide: VaultPopupListFiltersService, useValue: filtersSvc },
        { provide: VaultPopupLoadingService, useValue: loadingSvc },
        { provide: VaultPopupScrollPositionService, useValue: scrollSvc },
        {
          provide: AccountService,
          useValue: { activeAccount$ },
        },
        { provide: CipherService, useValue: cipherSvc },
        { provide: DialogService, useValue: dialogSvc },
        { provide: IntroCarouselService, useValue: introSvc },
        { provide: NudgesService, useValue: nudgesSvc },
        {
          provide: VaultPopupCopyButtonsService,
          useValue: { showQuickCopyActions$: new BehaviorSubject<boolean>(false) },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingSvc,
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key, t: (key: string) => key },
        },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>() },
        { provide: RestrictedItemTypesService, useValue: { restricted$: new BehaviorSubject([]) } },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: AvatarService, useValue: mock<AvatarService>() },
        { provide: ActivatedRoute, useValue: mock<ActivatedRoute>() },
        { provide: AuthService, useValue: mock<AuthService>() },
        { provide: AutofillService, useValue: mock<AutofillService>() },
        {
          provide: VaultPopupAutofillService,
          useValue: mock<VaultPopupAutofillService>(),
        },
        { provide: TaskService, useValue: mock<TaskService>() },
        { provide: StateProvider, useValue: mock<StateProvider>() },
        {
          provide: ConfigService,
          useValue: configSvc,
        },
        {
          provide: SearchService,
          useValue: { isCipherSearching$: of(false) },
        },
        {
          provide: AutomaticUserConfirmationService,
          useValue: autoConfirmSvc,
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    TestBed.overrideComponent(VaultV2Component, {
      remove: {
        imports: [
          PopupHeaderComponent,
          VaultHeaderV2Component,
          CurrentAccountComponent,
          NewItemDropdownV2Component,
          PopOutComponent,
          BlockedInjectionBanner,
          AtRiskPasswordCalloutComponent,
          AutofillVaultListItemsComponent,
          VaultListItemsContainerComponent,
        ],
        providers: [
          { provide: VaultItemsTransferService, useValue: DefaultVaultItemsTransferService },
        ],
      },
      add: {
        imports: [
          PopupHeaderStubComponent,
          VaultHeaderV2StubComponent,
          CurrentAccountStubComponent,
          NewItemDropdownStubComponent,
          PopOutStubComponent,
          BlockedInjectionBannerStubComponent,
          VaultAtRiskCalloutStubComponent,
          AutofillVaultListItemsStubComponent,
          VaultListItemsContainerStubComponent,
        ],
        providers: [{ provide: VaultItemsTransferService, useValue: vaultItemsTransferSvc }],
      },
    });

    const fixture = TestBed.createComponent(VaultV2Component);
    component = fixture.componentInstance;
  });

  describe("vaultState", () => {
    type ExpectedKey = "Empty" | "DeactivatedOrg" | "NoResults" | null;

    const cases: [string, boolean, boolean, boolean, ExpectedKey][] = [
      ["null when none true", false, false, false, null],
      ["Empty when empty true only", true, false, false, "Empty"],
      ["DeactivatedOrg when only deactivated true", false, false, true, "DeactivatedOrg"],
      ["NoResults when only noResults true", false, true, false, "NoResults"],
    ];

    it.each(cases)(
      "%s",
      fakeAsync(
        (
          _label: string,
          empty: boolean,
          noResults: boolean,
          deactivated: boolean,
          expectedKey: ExpectedKey,
        ) => {
          const empty$ = itemsSvc.emptyVault$ as BehaviorSubject<boolean>;
          const noResults$ = itemsSvc.noFilteredResults$ as BehaviorSubject<boolean>;
          const deactivated$ = itemsSvc.showDeactivatedOrg$ as BehaviorSubject<boolean>;

          empty$.next(empty);
          noResults$.next(noResults);
          deactivated$.next(deactivated);
          tick();

          const expectedValue =
            expectedKey === null ? null : (component as any).VaultStateEnum[expectedKey];

          expect((component as any).vaultState).toBe(expectedValue);
        },
      ),
    );
  });

  it("loading$ is true when items loading or filters missing; false when both ready", () => {
    const vaultLoading$ = loadingSvc.loading$ as unknown as BehaviorSubject<boolean>;
    const allFilters$ = filtersSvc.allFilters$ as unknown as Subject<any>;
    const readySubject$ = component["readySubject"] as unknown as BehaviorSubject<boolean>;

    const values: boolean[] = [];
    getObs<boolean>(component, "loading$").subscribe((v) => values.push(!!v));

    vaultLoading$.next(true);

    allFilters$.next({});

    vaultLoading$.next(false);

    readySubject$.next(true);

    expect(values[values.length - 1]).toBe(false);
  });

  it("passes popup-page scroll region element to scroll position service", fakeAsync(() => {
    const fixture = TestBed.createComponent(VaultV2Component);
    const component = fixture.componentInstance;

    const readySubject$ = component["readySubject"] as unknown as BehaviorSubject<boolean>;
    const vaultLoading$ = loadingSvc.loading$ as unknown as BehaviorSubject<boolean>;
    const allFilters$ = filtersSvc.allFilters$ as unknown as Subject<any>;

    fixture.detectChanges();
    tick();

    const scrollRegion = fixture.nativeElement.querySelector(
      '[data-testid="popup-layout-scroll-region"]',
    ) as HTMLElement;

    // Unblock loading
    vaultLoading$.next(false);
    readySubject$.next(true);
    allFilters$.next({});
    tick();

    expect(scrollSvc.start).toHaveBeenCalledWith(scrollRegion);
  }));

  it("showPremiumDialog opens PremiumUpgradeDialogComponent", () => {
    component["showPremiumDialog"]();
    expect(PremiumUpgradeDialogComponent.open).toHaveBeenCalledTimes(1);
  });

  it("navigateToImport navigates to import route", fakeAsync(async () => {
    const ngRouter = TestBed.inject(Router);
    jest.spyOn(ngRouter, "navigate").mockResolvedValue(true as any);

    await component["navigateToImport"]();

    expect(ngRouter.navigate).toHaveBeenCalledWith(["/import"]);
  }));

  it("ngOnInit dismisses intro carousel and opens decryption dialog for non-deleted failures", fakeAsync(() => {
    (cipherSvc.failedToDecryptCiphers$ as any).mockReturnValue(
      of([
        { id: "a", isDeleted: false },
        { id: "b", isDeleted: true },
        { id: "c", isDeleted: false },
      ]),
    );

    void component.ngOnInit();
    tick();

    expect(introSvc.setIntroCarouselDismissed).toHaveBeenCalled();

    expect(DecryptionFailureDialogComponent.open).toHaveBeenCalledWith(expect.any(Object), {
      cipherIds: ["a", "c"],
    });

    flush();
  }));

  it("dismissVaultNudgeSpotlight forwards to NudgesService with active user id", fakeAsync(() => {
    const spy = jest.spyOn(nudgesSvc, "dismissNudge").mockResolvedValue(undefined);

    activeAccount$.next({ id: "user-xyz" });

    void component.ngOnInit();
    tick();

    void component["dismissVaultNudgeSpotlight"](NudgeType.HasVaultItems);
    tick();

    expect(spy).toHaveBeenCalledWith(NudgeType.HasVaultItems, "user-xyz");
  }));

  it("accountAgeInDays$ computes integer days since creation", (done) => {
    activeAccount$.next({
      id: "user-123",
      creationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    } as any);
    getObs<number | null>(component, "accountAgeInDays$").subscribe((days) => {
      if (days !== null) {
        expect(days).toBeGreaterThanOrEqual(7);
        done();
      }
    });

    void component.ngOnInit();
  });

  it("renders Premium spotlight when eligible and opens dialog on click", fakeAsync(() => {
    itemsSvc.cipherCount$.next(10);

    hasPremiumFromAnySource$.next(false);

    configSvc.getFeatureFlag$.mockImplementation((_flag: string) => of(true));

    nudgesSvc.showNudgeSpotlight$.mockImplementation((type: NudgeType) =>
      of(type === NudgeType.PremiumUpgrade),
    );

    const fixture = TestBed.createComponent(VaultV2Component);
    const component = fixture.componentInstance;

    void component.ngOnInit();

    fixture.detectChanges();
    tick();

    fixture.detectChanges();

    const spotlights = Array.from(
      fixture.nativeElement.querySelectorAll("bit-spotlight"),
    ) as HTMLElement[];
    expect(spotlights.length).toBe(1);

    const spotDe = fixture.debugElement.query(By.css("bit-spotlight"));
    expect(spotDe).toBeTruthy();

    spotDe.triggerEventHandler("onButtonClick", undefined);
    fixture.detectChanges();

    expect(PremiumUpgradeDialogComponent.open).toHaveBeenCalledTimes(1);
  }));

  it("renders Empty-Vault spotlight when vaultState is Empty and nudge is on", fakeAsync(() => {
    configSvc.getFeatureFlag$.mockImplementation((_flag: string) => of(false));

    itemsSvc.emptyVault$.next(true);

    nudgesSvc.showNudgeSpotlight$.mockImplementation((type: NudgeType) => {
      return of(type === NudgeType.EmptyVaultNudge);
    });

    const fixture = TestBed.createComponent(VaultV2Component);
    fixture.detectChanges();
    tick();

    const spotlights = queryAllSpotlights(fixture);
    expect(spotlights.length).toBe(1);

    expect(fixture.nativeElement.textContent).toContain("emptyVaultNudgeTitle");
  }));

  it("renders Has-Items spotlight when vault has items and nudge is on", fakeAsync(() => {
    itemsSvc.emptyVault$.next(false);

    (nudgesSvc.showNudgeSpotlight$ as jest.Mock).mockImplementation((type: NudgeType) => {
      return of(type === NudgeType.HasVaultItems);
    });

    const fixture = TestBed.createComponent(VaultV2Component);
    fixture.detectChanges();
    tick();

    const spotlights = queryAllSpotlights(fixture);
    expect(spotlights.length).toBe(1);

    expect(fixture.nativeElement.textContent).toContain("hasItemsVaultNudgeTitle");
  }));

  it("does not render Premium spotlight when account is less than a week old", fakeAsync(() => {
    itemsSvc.cipherCount$.next(10);
    hasPremiumFromAnySource$.next(false);

    (nudgesSvc.showNudgeSpotlight$ as jest.Mock).mockImplementation((type: NudgeType) => {
      return of(type === NudgeType.PremiumUpgrade);
    });

    const fixture = TestBed.createComponent(VaultV2Component);
    fixture.detectChanges();
    tick();

    const spotlights = queryAllSpotlights(fixture);
    expect(spotlights.length).toBe(0);
  }));

  it("does not render Premium spotlight when vault has less than 5 items", fakeAsync(() => {
    itemsSvc.cipherCount$.next(3);
    hasPremiumFromAnySource$.next(false);

    (nudgesSvc.showNudgeSpotlight$ as jest.Mock).mockImplementation((type: NudgeType) => {
      return of(type === NudgeType.PremiumUpgrade);
    });

    const fixture = TestBed.createComponent(VaultV2Component);
    fixture.detectChanges();
    tick();

    const spotlights = queryAllSpotlights(fixture);
    expect(spotlights.length).toBe(0);
  }));

  it("does not render Premium spotlight when user already has premium", fakeAsync(() => {
    itemsSvc.cipherCount$.next(10);
    hasPremiumFromAnySource$.next(true);

    (nudgesSvc.showNudgeSpotlight$ as jest.Mock).mockImplementation((type: NudgeType) => {
      return of(type === NudgeType.PremiumUpgrade);
    });

    const fixture = TestBed.createComponent(VaultV2Component);
    fixture.detectChanges();
    tick();

    const spotlights = queryAllSpotlights(fixture);
    expect(spotlights.length).toBe(0);
  }));

  it("does not render app-autofill-vault-list-items or favorites item container when hasSearchText$ is true", () => {
    itemsSvc.hasSearchText$.next(true);

    const fixture = TestBed.createComponent(VaultV2Component);
    component = fixture.componentInstance;

    const readySubject$ = component["readySubject"];
    const allFilters$ = filtersSvc.allFilters$ as unknown as Subject<any>;

    // Unblock loading
    readySubject$.next(true);
    allFilters$.next({});
    fixture.detectChanges();

    const autofillElement = fixture.debugElement.query(By.css("app-autofill-vault-list-items"));
    expect(autofillElement).toBeFalsy();

    const favoritesElement = fixture.debugElement.query(By.css("#favorites"));
    expect(favoritesElement).toBeFalsy();
  });

  it("does render app-autofill-vault-list-items and favorites item container when hasSearchText$ is false", () => {
    // Ensure vaultState is null (not Empty, NoResults, or DeactivatedOrg)
    itemsSvc.emptyVault$.next(false);
    itemsSvc.noFilteredResults$.next(false);
    itemsSvc.showDeactivatedOrg$.next(false);
    itemsSvc.hasSearchText$.next(false);
    loadingSvc.loading$.next(false);

    const fixture = TestBed.createComponent(VaultV2Component);
    component = fixture.componentInstance;

    const readySubject$ = component["readySubject"];
    const allFilters$ = filtersSvc.allFilters$ as unknown as Subject<any>;

    // Unblock loading
    readySubject$.next(true);
    allFilters$.next({});
    fixture.detectChanges();

    const autofillElement = fixture.debugElement.query(By.css("app-autofill-vault-list-items"));
    expect(autofillElement).toBeTruthy();

    const favoritesElement = fixture.debugElement.query(By.css("#favorites"));
    expect(favoritesElement).toBeTruthy();
  });

  it("does set the title for allItems container to allItems when hasSearchText$ and numberOfAppliedFilters$ are false and 0 respectively", () => {
    // Ensure vaultState is null (not Empty, NoResults, or DeactivatedOrg)
    itemsSvc.emptyVault$.next(false);
    itemsSvc.noFilteredResults$.next(false);
    itemsSvc.showDeactivatedOrg$.next(false);
    itemsSvc.hasSearchText$.next(false);
    filtersSvc.numberOfAppliedFilters$.next(0);
    loadingSvc.loading$.next(false);

    const fixture = TestBed.createComponent(VaultV2Component);
    component = fixture.componentInstance;

    const readySubject$ = component["readySubject"];
    const allFilters$ = filtersSvc.allFilters$ as unknown as Subject<any>;

    // Unblock loading
    readySubject$.next(true);
    allFilters$.next({});
    fixture.detectChanges();

    const allItemsElement = fixture.debugElement.query(By.css("#allItems"));
    const allItemsTitle = allItemsElement.componentInstance.title();
    expect(allItemsTitle).toBe("allItems");
  });

  it("does set the title for allItems container to searchResults when hasSearchText$ is true", () => {
    // Ensure vaultState is null (not Empty, NoResults, or DeactivatedOrg)
    itemsSvc.emptyVault$.next(false);
    itemsSvc.noFilteredResults$.next(false);
    itemsSvc.showDeactivatedOrg$.next(false);
    itemsSvc.hasSearchText$.next(true);
    loadingSvc.loading$.next(false);

    const fixture = TestBed.createComponent(VaultV2Component);
    component = fixture.componentInstance;

    const readySubject$ = component["readySubject"];
    const allFilters$ = filtersSvc.allFilters$ as unknown as Subject<any>;

    // Unblock loading
    readySubject$.next(true);
    allFilters$.next({});
    fixture.detectChanges();

    const allItemsElement = fixture.debugElement.query(By.css("#allItems"));
    const allItemsTitle = allItemsElement.componentInstance.title();
    expect(allItemsTitle).toBe("searchResults");
  });

  it("does set the title for allItems container to items when numberOfAppliedFilters$ is > 0", fakeAsync(() => {
    // Ensure vaultState is null (not Empty, NoResults, or DeactivatedOrg)
    itemsSvc.emptyVault$.next(false);
    itemsSvc.noFilteredResults$.next(false);
    itemsSvc.showDeactivatedOrg$.next(false);
    itemsSvc.hasSearchText$.next(false);
    filtersSvc.numberOfAppliedFilters$.next(1);
    loadingSvc.loading$.next(false);

    const fixture = TestBed.createComponent(VaultV2Component);
    component = fixture.componentInstance;

    const readySubject$ = component["readySubject"];
    const allFilters$ = filtersSvc.allFilters$ as unknown as Subject<any>;

    // Unblock loading
    readySubject$.next(true);
    allFilters$.next({});
    fixture.detectChanges();

    const allItemsElement = fixture.debugElement.query(By.css("#allItems"));
    const allItemsTitle = allItemsElement.componentInstance.title();
    expect(allItemsTitle).toBe("items");
  }));

  describe("AutoConfirmExtensionSetupDialog", () => {
    beforeEach(() => {
      autoConfirmDialogSpy.mockClear();
    });

    it("opens dialog when canManage is true and showBrowserNotification is undefined", fakeAsync(() => {
      autoConfirmSvc.canManageAutoConfirm$.mockReturnValue(of(true));
      autoConfirmSvc.configuration$.mockReturnValue(
        of({
          enabled: false,
          showSetupDialog: true,
          showBrowserNotification: undefined,
        }),
      );

      const fixture = TestBed.createComponent(VaultV2Component);
      const component = fixture.componentInstance;

      void component.ngOnInit();
      tick();

      expect(autoConfirmDialogSpy).toHaveBeenCalledWith(expect.any(Object));
    }));

    it("does not open dialog when showBrowserNotification is false", fakeAsync(() => {
      autoConfirmSvc.canManageAutoConfirm$.mockReturnValue(of(true));
      autoConfirmSvc.configuration$.mockReturnValue(
        of({
          enabled: false,
          showSetupDialog: true,
          showBrowserNotification: false,
        }),
      );

      const fixture = TestBed.createComponent(VaultV2Component);
      const component = fixture.componentInstance;

      void component.ngOnInit();
      tick();

      expect(autoConfirmDialogSpy).not.toHaveBeenCalled();
    }));

    it("does not open dialog when showBrowserNotification is true", fakeAsync(() => {
      autoConfirmSvc.canManageAutoConfirm$.mockReturnValue(of(true));
      autoConfirmSvc.configuration$.mockReturnValue(
        of({
          enabled: true,
          showSetupDialog: true,
          showBrowserNotification: true,
        }),
      );

      const fixture = TestBed.createComponent(VaultV2Component);
      const component = fixture.componentInstance;

      void component.ngOnInit();
      tick();

      expect(autoConfirmDialogSpy).not.toHaveBeenCalled();
    }));

    it("does not open dialog when canManage is false even if showBrowserNotification is undefined", fakeAsync(() => {
      autoConfirmSvc.canManageAutoConfirm$.mockReturnValue(of(false));
      autoConfirmSvc.configuration$.mockReturnValue(
        of({
          enabled: false,
          showSetupDialog: true,
          showBrowserNotification: undefined,
        }),
      );

      const fixture = TestBed.createComponent(VaultV2Component);
      const component = fixture.componentInstance;

      void component.ngOnInit();
      tick();

      expect(autoConfirmDialogSpy).not.toHaveBeenCalled();
    }));
  });
});
