import { CdkVirtualScrollableElement } from "@angular/cdk/scrolling";
import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed, fakeAsync, flush, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Observable, Subject, of } from "rxjs";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { NudgeType, NudgesService } from "@bitwarden/angular/vault";
import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
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
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { TaskService } from "@bitwarden/common/vault/tasks";
import { DialogService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import { DecryptionFailureDialogComponent } from "@bitwarden/vault";

import { BrowserApi } from "../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../platform/browser/browser-popup-utils";
import { IntroCarouselService } from "../../services/intro-carousel.service";
import { VaultPopupAutofillService } from "../../services/vault-popup-autofill.service";
import { VaultPopupCopyButtonsService } from "../../services/vault-popup-copy-buttons.service";
import { VaultPopupItemsService } from "../../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../../services/vault-popup-list-filters.service";
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
} as unknown as import("@bitwarden/components").DialogRef<any, any>;

jest
  .spyOn(PremiumUpgradeDialogComponent, "open")
  .mockImplementation((_: DialogService) => mockDialogRef as any);

jest
  .spyOn(DecryptionFailureDialogComponent, "open")
  .mockImplementation((_: DialogService, _params: any) => mockDialogRef as any);
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
    cipherCount$: new BehaviorSubject<number>(0),
    loading$: new BehaviorSubject<boolean>(true),
  } as Partial<VaultPopupItemsService>;

  const filtersSvc = {
    allFilters$: new Subject<any>(),
    filters$: new BehaviorSubject<any>({}),
    filterVisibilityState$: new BehaviorSubject<any>({}),
  } as Partial<VaultPopupListFiltersService>;

  const accountActive$ = new BehaviorSubject<FakeAccount | null>({ id: "user-1" });

  const cipherSvc = {
    failedToDecryptCiphers$: jest.fn().mockReturnValue(of([])),
  } as Partial<CipherService>;

  const nudgesSvc = {
    showNudgeSpotlight$: jest.fn().mockImplementation((_type: NudgeType) => of(false)),
    dismissNudge: jest.fn().mockResolvedValue(undefined),
  } as Partial<NudgesService>;

  const dialogSvc = {} as Partial<DialogService>;

  const introSvc = {
    setIntroCarouselDismissed: jest.fn().mockResolvedValue(undefined),
  } as Partial<IntroCarouselService>;

  const scrollSvc = {
    start: jest.fn(),
    stop: jest.fn(),
  } as Partial<VaultPopupScrollPositionService>;

  function getObs<T = unknown>(cmp: any, key: string): Observable<T> {
    return cmp[key] as Observable<T>;
  }

  const hasPremiumFromAnySource$ = new BehaviorSubject<boolean>(false);

  const billingSvc = {
    hasPremiumFromAnySource$: (_: string) => hasPremiumFromAnySource$,
  };

  const vaultProfileSvc = {
    getProfileCreationDate: jest
      .fn()
      .mockResolvedValue(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)), // 8 days ago
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [VaultV2Component, RouterTestingModule],
      providers: [
        { provide: VaultPopupItemsService, useValue: itemsSvc },
        { provide: VaultPopupListFiltersService, useValue: filtersSvc },
        { provide: VaultPopupScrollPositionService, useValue: scrollSvc },
        {
          provide: AccountService,
          useValue: { activeAccount$: accountActive$ },
        },
        { provide: CipherService, useValue: cipherSvc },
        { provide: DialogService, useValue: dialogSvc },
        { provide: IntroCarouselService, useValue: introSvc },
        { provide: NudgesService, useValue: nudgesSvc },
        {
          provide: VaultProfileService,
          useValue: vaultProfileSvc,
        },
        {
          provide: VaultPopupCopyButtonsService,
          useValue: { showQuickCopyActions$: new BehaviorSubject<boolean>(false) },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingSvc,
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
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
        { provide: ConfigService, useValue: mock<ConfigService>() },
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
    const itemsLoading$ = itemsSvc.loading$ as unknown as BehaviorSubject<boolean>;
    const allFilters$ = filtersSvc.allFilters$ as unknown as Subject<any>;

    const values: boolean[] = [];
    getObs<boolean>(component, "loading$").subscribe((v) => values.push(!!v));

    itemsLoading$.next(true);

    allFilters$.next({});

    itemsLoading$.next(false);

    expect(values[values.length - 1]).toBe(false);
  });

  it("ngAfterViewInit waits for allFilters$ then starts scroll position service", fakeAsync(() => {
    const allFilters$ = filtersSvc.allFilters$ as unknown as Subject<any>;

    (component as any).virtualScrollElement = {} as CdkVirtualScrollableElement;

    component.ngAfterViewInit();
    expect(scrollSvc.start).not.toHaveBeenCalled();

    allFilters$.next({ any: true });
    tick();

    expect(scrollSvc.start).toHaveBeenCalledTimes(1);
    expect(scrollSvc.start).toHaveBeenCalledWith((component as any).virtualScrollElement);

    flush();
  }));

  it("showPremiumDialog opens PremiumUpgradeDialogComponent", () => {
    component["showPremiumDialog"]();
    expect(PremiumUpgradeDialogComponent.open).toHaveBeenCalledTimes(1);
  });

  it("navigateToImport navigates and opens popout if popup is open", fakeAsync(async () => {
    (BrowserApi.isPopupOpen as jest.Mock).mockResolvedValueOnce(true);

    const ngRouter = TestBed.inject(Router);
    jest.spyOn(ngRouter, "navigate").mockResolvedValue(true as any);

    await component["navigateToImport"]();

    expect(ngRouter.navigate).toHaveBeenCalledWith(["/import"]);

    expect(BrowserPopupUtils.openCurrentPagePopout).toHaveBeenCalled();
  }));

  it("navigateToImport does not popout when popup is not open", fakeAsync(async () => {
    (BrowserApi.isPopupOpen as jest.Mock).mockResolvedValueOnce(false);

    const ngRouter = TestBed.inject(Router);
    jest.spyOn(ngRouter, "navigate").mockResolvedValue(true as any);

    await component["navigateToImport"]();

    expect(ngRouter.navigate).toHaveBeenCalledWith(["/import"]);
    expect(BrowserPopupUtils.openCurrentPagePopout).not.toHaveBeenCalled();
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

    accountActive$.next({ id: "user-xyz" });

    void component.ngOnInit();
    tick();

    void component["dismissVaultNudgeSpotlight"](NudgeType.HasVaultItems);
    tick();

    expect(spy).toHaveBeenCalledWith(NudgeType.HasVaultItems, "user-xyz");
  }));

  it("accountAgeInDays$ computes integer days since creation", (done) => {
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

    (nudgesSvc.showNudgeSpotlight$ as jest.Mock).mockImplementation((type: NudgeType) =>
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
    itemsSvc.emptyVault$.next(true);

    (nudgesSvc.showNudgeSpotlight$ as jest.Mock).mockImplementation((type: NudgeType) => {
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

    vaultProfileSvc.getProfileCreationDate = jest
      .fn()
      .mockResolvedValue(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)); // 3 days ago

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
});
