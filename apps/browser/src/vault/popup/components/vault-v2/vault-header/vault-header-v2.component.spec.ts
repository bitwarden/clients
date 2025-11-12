import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { PasswordRepromptService } from "@bitwarden/vault";

import { AutofillService } from "../../../../../autofill/services/abstractions/autofill.service";
import { VaultPopupItemsService } from "../../../../../vault/popup/services/vault-popup-items.service";
import {
  PopupListFilter,
  VaultPopupListFiltersService,
} from "../../../../../vault/popup/services/vault-popup-list-filters.service";
import { VaultPopupLoadingService } from "../../../services/vault-popup-loading.service";

import { VaultHeaderV2Component } from "./vault-header-v2.component";

describe("VaultHeaderV2Component", () => {
  let component: VaultHeaderV2Component;
  let fixture: ComponentFixture<VaultHeaderV2Component>;

  const emptyForm: PopupListFilter = {
    organization: null,
    collection: null,
    folder: null,
    cipherType: null,
  };

  const numberOfAppliedFilters$ = new BehaviorSubject<number>(0);
  const state$ = new Subject<boolean | null>();

  // Mock state provider update
  const update = jest.fn().mockResolvedValue(undefined);

  /** When it exists, returns the notification badge debug element */
  const getBadge = () => fixture.debugElement.query(By.css('[data-testid="filter-badge"]'));

  beforeEach(async () => {
    update.mockClear();

    await TestBed.configureTestingModule({
      imports: [VaultHeaderV2Component, CommonModule],
      providers: [
        {
          provide: CipherService,
          useValue: mock<CipherService>({
            cipherViews$: jest.fn().mockReturnValue(new BehaviorSubject([])),
          }),
        },
        { provide: VaultSettingsService, useValue: mock<VaultSettingsService>() },
        { provide: FolderService, useValue: mock<FolderService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        { provide: SearchService, useValue: mock<SearchService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: AutofillService, useValue: mock<AutofillService>() },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: MessageSender, useValue: mock<MessageSender>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: VaultPopupItemsService,
          useValue: mock<VaultPopupItemsService>({ searchText$: new BehaviorSubject("") }),
        },
        {
          provide: SyncService,
          useValue: mock<SyncService>({ activeUserLastSync$: () => new Subject() }),
        },
        { provide: ActivatedRoute, useValue: { queryParams: new BehaviorSubject({}) } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: VaultPopupListFiltersService,
          useValue: {
            numberOfAppliedFilters$,
            filters$: new BehaviorSubject(emptyForm),
            filterForm: new FormBuilder().group(emptyForm),
            filterVisibilityState$: state$,
            updateFilterVisibility: update,
          },
        },
        {
          provide: StateProvider,
          useValue: { getGlobal: () => ({ state$, update }) },
        },
        {
          provide: VaultPopupLoadingService,
          useValue: { loading$: new BehaviorSubject(false) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultHeaderV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("does not show filter badge when no filters are selected", () => {
    state$.next(false);
    numberOfAppliedFilters$.next(0);
    fixture.detectChanges();

    expect(getBadge()).toBeNull();
  });

  it("does not show filter badge when disclosure is open", () => {
    state$.next(true);
    numberOfAppliedFilters$.next(1);
    fixture.detectChanges();

    expect(getBadge()).toBeNull();
  });

  it("shows the notification badge when there are populated filters and the disclosure is closed", async () => {
    state$.next(false);
    numberOfAppliedFilters$.next(1);
    fixture.detectChanges();

    expect(getBadge()).not.toBeNull();
  });

  it("displays the number of filters populated", () => {
    numberOfAppliedFilters$.next(1);
    state$.next(false);
    fixture.detectChanges();

    expect(getBadge().nativeElement.textContent.trim()).toBe("1");

    numberOfAppliedFilters$.next(2);

    fixture.detectChanges();

    expect(getBadge().nativeElement.textContent.trim()).toBe("2");

    numberOfAppliedFilters$.next(4);

    fixture.detectChanges();

    expect(getBadge().nativeElement.textContent.trim()).toBe("4");
  });

  it("defaults the initial state to true", (done) => {
    // The initial value of the `state$` variable above is undefined
    component["initialDisclosureVisibility$"].subscribe((initialVisibility) => {
      expect(initialVisibility).toBe(true);
      done();
    });

    // Update the state to null
    state$.next(null);
  });
});
