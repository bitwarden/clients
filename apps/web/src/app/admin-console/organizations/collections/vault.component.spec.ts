import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  ASSIGN_COLLECTIONS_DIALOG,
  BULK_DELETE_DIALOG,
  BULK_EDIT_COLLECTION_ACCESS_DIALOG,
  CipherFormConfigService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterModel,
  RoutedVaultFilterService,
  VaultBatchBarService,
  VaultFilter,
  VaultFilterServiceAbstraction as VaultFilterService,
} from "@bitwarden/vault";

import { OrganizationWarningsService } from "../../../billing/organizations/warnings/services";
import { GroupApiService } from "../core";

import { VaultCipherActionsService } from "./services/vault-cipher-actions.service";
import { VaultCollectionActionsService } from "./services/vault-collection-actions.service";
import { VaultCollectionService } from "./services/vault-collection.service";
import { VaultComponent } from "./vault.component";

const USER_ID = "test-user-id" as UserId;
const ORG_A_ID = "org-a" as OrganizationId;
const ORG_B_ID = "org-b" as OrganizationId;

function makeOrg(id: OrganizationId, overrides: Partial<Organization> = {}): Organization {
  return {
    id,
    canEditAllCiphers: true,
    canEditAnyCollection: true,
    isMember: true,
    isProviderUser: false,
    useEvents: false,
    ...overrides,
  } as unknown as Organization;
}

describe("VaultComponent", () => {
  let fixture: ComponentFixture<VaultComponent>;
  let component: VaultComponent;

  let filterSubject$: BehaviorSubject<RoutedVaultFilterModel>;
  let organizationService: MockProxy<OrganizationService>;
  let cipherService: MockProxy<CipherService>;
  let syncService: MockProxy<SyncService>;

  beforeEach(async () => {
    filterSubject$ = new BehaviorSubject<RoutedVaultFilterModel>({ organizationId: ORG_A_ID });

    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([makeOrg(ORG_A_ID), makeOrg(ORG_B_ID)]));

    cipherService = mock<CipherService>();
    cipherService.getAllFromApiForOrganization.mockResolvedValue([]);
    cipherService.getManyFromApiForOrganization.mockResolvedValue([]);

    syncService = mock<SyncService>();
    syncService.fullSync.mockResolvedValue(undefined);

    const routedVaultFilterService = {
      filter$: filterSubject$,
    } as unknown as RoutedVaultFilterService;

    const collectionService: Partial<VaultCollectionService> = {
      allCollections$: of([]),
      collections$: of([]),
      selectedCollection$: of(undefined),
      showCollectionAccessRestricted$: of(false),
      showAddAccessToggle$: of(false),
      setAddAccessStatus: jest.fn(),
      reload: jest.fn(),
    };

    const cipherActionsService = {
      refresh$: new Subject<void>(),
      navigate$: new Subject<{ queryParams: unknown; options?: NavigationExtras }>(),
      activeFilter$: of(new VaultFilter()),
      get hasOpenDialog() {
        return false;
      },
    } as unknown as VaultCipherActionsService;

    const collectionActionsService = {
      refresh$: new Subject<void>(),
    } as unknown as VaultCollectionActionsService;

    const vaultBatchBarService = {
      completed$: new Subject<void>(),
      setConfig: jest.fn(),
    } as unknown as VaultBatchBarService<CipherView>;

    const restrictedItemTypesService = mock<RestrictedItemTypesService>();
    (restrictedItemTypesService as { restricted$: unknown }).restricted$ = of([]);
    restrictedItemTypesService.isCipherRestricted.mockReturnValue(false);

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    const organizationWarningsService = mock<OrganizationWarningsService>();
    organizationWarningsService.showInactiveSubscriptionDialog$.mockReturnValue(of(undefined));
    organizationWarningsService.showSubscribeBeforeFreeTrialEndsDialog$.mockReturnValue(
      of(undefined),
    );

    const groupService = mock<GroupApiService>();
    groupService.getAll.mockResolvedValue([]);

    const vaultFilterService = mock<VaultFilterService>();

    await TestBed.configureTestingModule({
      imports: [VaultComponent],
      providers: [
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: mockAccountServiceWith(USER_ID) },
        { provide: ConfigService, useValue: configService },
        { provide: I18nService, useValue: { t: (k: string) => k } },
        { provide: PlatformUtilsService, useValue: { isSelfHost: () => false } },
        { provide: CipherService, useValue: cipherService },
        { provide: SearchService, useValue: mock<SearchService>() },
        { provide: GroupApiService, useValue: groupService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: BillingApiServiceAbstraction,
          useValue: mock<BillingApiServiceAbstraction>(),
        },
        { provide: OrganizationWarningsService, useValue: organizationWarningsService },
        { provide: RestrictedItemTypesService, useValue: restrictedItemTypesService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: SyncService, useValue: syncService },
        { provide: VaultFilterService, useValue: vaultFilterService },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: Router, useValue: { navigate: jest.fn().mockResolvedValue(true) } },
      ],
    })
      .overrideComponent(VaultComponent, {
        // Empty imports so no module providers leak in via the component's import chain.
        // The template override below makes the missing pipe/directive imports irrelevant.
        set: {
          imports: [],
          providers: [
            { provide: RoutedVaultFilterService, useValue: routedVaultFilterService },
            {
              provide: RoutedVaultFilterBridgeService,
              useValue: mock<RoutedVaultFilterBridgeService>(),
            },
            { provide: CipherFormConfigService, useValue: mock<CipherFormConfigService>() },
            { provide: VaultCollectionActionsService, useValue: collectionActionsService },
            { provide: VaultCollectionService, useValue: collectionService },
            { provide: VaultCipherActionsService, useValue: cipherActionsService },
            { provide: VaultBatchBarService, useValue: vaultBatchBarService },
            { provide: ASSIGN_COLLECTIONS_DIALOG, useValue: {} },
            { provide: BULK_DELETE_DIALOG, useValue: {} },
            { provide: BULK_EDIT_COLLECTION_ACCESS_DIALOG, useValue: {} },
          ],
        },
      })
      .overrideTemplate(VaultComponent, "")
      .compileComponents();

    fixture = TestBed.createComponent(VaultComponent);
    component = fixture.componentInstance;
  });

  /**
   * Regression guard for the bug fixed in PM-20067:
   * Angular reuses the component instance across org switches, so the reactive
   * chain (organizationId$ + distinctUntilChanged → allCiphers$) must re-fire
   * when the route filter changes to a different organization.
   */
  describe("organization switching", () => {
    it("re-fetches ciphers for the initial organization on load", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(cipherService.getAllFromApiForOrganization).toHaveBeenCalledWith(ORG_A_ID);
    });

    it("re-fetches ciphers for the new organization when the route switches orgs", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      filterSubject$.next({ organizationId: ORG_B_ID });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(cipherService.getAllFromApiForOrganization).toHaveBeenCalledWith(ORG_B_ID);
    });

    it("does not re-fetch when the same organization is emitted again", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const callsBefore = (cipherService.getAllFromApiForOrganization as jest.Mock).mock.calls
        .length;

      // Emit the same orgId — distinctUntilChanged should suppress the re-fetch
      filterSubject$.next({ organizationId: ORG_A_ID });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(cipherService.getAllFromApiForOrganization).toHaveBeenCalledTimes(callsBefore);
    });
  });

  describe("isRefreshing$", () => {
    it("starts as true before the first load completes", () => {
      const values: boolean[] = [];
      component["isRefreshing$"].subscribe((v) => values.push(v));

      // Before detectChanges (ngOnInit hasn't run), it should be true
      expect(values).toEqual([true]);
    });

    it("becomes false after the first collections load", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const current = await new Promise<boolean>((resolve) =>
        component["isRefreshing$"].subscribe(resolve),
      );

      expect(current).toBe(false);
    });
  });
});
