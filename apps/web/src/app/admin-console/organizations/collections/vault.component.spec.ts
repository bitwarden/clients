import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, NEVER, of, Subscription } from "rxjs";

import { CollectionAdminService, CollectionService } from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import {
  ASSIGN_COLLECTIONS_DIALOG,
  BULK_DELETE_DIALOG,
  BULK_EDIT_COLLECTION_ACCESS_DIALOG,
  CipherFormConfig,
  CipherFormConfigService,
  PasswordRepromptService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterModel,
  RoutedVaultFilterService,
  VaultBatchBarService,
  VaultFilter,
  VaultFilterServiceAbstraction,
  VaultItemDialogComponent,
  VaultItemDialogResult,
} from "@bitwarden/vault";

import { OrganizationWarningsService } from "../../../billing/organizations/warnings/services";
import { GroupApiService } from "../core";

import { VaultComponent } from "./vault.component";

const ORG_A_ID = "org-a-id" as OrganizationId;
const ORG_B_ID = "org-b-id" as OrganizationId;
const USER_ID = "test-user-id" as UserId;

function buildOrg(id: OrganizationId): Organization {
  return {
    id,
    userId: USER_ID,
    isMember: true,
    isProviderUser: false,
    canEditAllCiphers: true,
    canEditAnyCollection: true,
    canEditUnassignedCiphers: true,
    canCreateNewCollections: true,
    canEditUnmanagedCollections: false,
    allowAdminAccessToAllCollectionItems: false,
    permissions: { editAnyCollection: true },
  } as unknown as Organization;
}

describe("VaultComponent (org-vault)", () => {
  let fixture: ComponentFixture<VaultComponent>;
  let component: VaultComponent;

  /** Controls which organization the routed filter resolves to. */
  let filterSubject: BehaviorSubject<Partial<RoutedVaultFilterModel>>;
  let cipherService: MockProxy<CipherService>;
  let cipherFormConfigService: MockProxy<CipherFormConfigService>;

  beforeEach(async () => {
    filterSubject = new BehaviorSubject<Partial<RoutedVaultFilterModel>>({
      organizationId: ORG_A_ID,
      collectionId: undefined,
      type: undefined,
    });

    cipherService = mock<CipherService>();
    cipherService.getAllFromApiForOrganization.mockResolvedValue([]);

    cipherFormConfigService = mock<CipherFormConfigService>();

    const collectionAdminService = mock<CollectionAdminService>();
    // Return an empty array so allCollectionsWithoutUnassigned$ settles immediately.
    collectionAdminService.collectionAdminViews$.mockReturnValue(of([] as CollectionAdminView[]));

    const groupApiService = mock<GroupApiService>();
    groupApiService.getAll.mockReturnValue(of([]));

    const searchService = mock<SearchService>();
    searchService.isSearchable.mockResolvedValue(false);

    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(
      of([buildOrg(ORG_A_ID), buildOrg(ORG_B_ID)]),
    );

    await TestBed.configureTestingModule({
      imports: [VaultComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: OrganizationService, useValue: organizationService },
        {
          provide: VaultFilterServiceAbstraction,
          useValue: { reloadCollections: jest.fn() },
        },
        { provide: SyncService, useValue: mock<SyncService>() },
        { provide: I18nService, useValue: { t: (k: string) => k } },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: BroadcasterService, useValue: mock<BroadcasterService>() },
        { provide: PlatformUtilsService, useValue: { isSelfHost: () => false } },
        { provide: CipherService, useValue: cipherService },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: CollectionAdminService, useValue: collectionAdminService },
        { provide: SearchService, useValue: searchService },
        { provide: SearchPipe, useValue: mock<SearchPipe>() },
        { provide: GroupApiService, useValue: groupApiService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: EventCollectionService, useValue: mock<EventCollectionService>() },
        { provide: TotpService, useValue: mock<TotpService>() },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: BillingApiServiceAbstraction, useValue: mock<BillingApiServiceAbstraction>() },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({ id: USER_ID, email: "test@bitwarden.com" }),
          },
        },
        {
          provide: OrganizationWarningsService,
          useValue: {
            showInactiveSubscriptionDialog$: jest.fn().mockReturnValue(NEVER),
            showSubscribeBeforeFreeTrialEndsDialog$: jest.fn().mockReturnValue(NEVER),
          },
        },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: RestrictedItemTypesService, useValue: { restricted$: of([]) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(VaultComponent, {
        // Strip module imports so Angular does not try to instantiate real services like
        // VaultFilterService (which transitively requires FolderService etc.). NO_ERRORS_SCHEMA
        // handles any unknown template elements left behind.
        // RoutedVaultFilterService, RoutedVaultFilterBridgeService, and CipherFormConfigService
        // are declared as component-level providers, so they must be overridden here too.
        set: {
          imports: [],
          template: "",
          providers: [
            {
              provide: RoutedVaultFilterService,
              useValue: { filter$: filterSubject.asObservable() },
            },
            {
              provide: RoutedVaultFilterBridgeService,
              useValue: { activeFilter$: of(new VaultFilter()) },
            },
            { provide: CipherFormConfigService, useValue: cipherFormConfigService },
            {
              provide: VaultBatchBarService,
              useValue: { completed$: NEVER, setConfig: jest.fn() },
            },
            { provide: ASSIGN_COLLECTIONS_DIALOG, useValue: mock() },
            { provide: BULK_DELETE_DIALOG, useValue: mock() },
            { provide: BULK_EDIT_COLLECTION_ACCESS_DIALOG, useValue: mock() },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VaultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit
  });

  it("creates the component", () => {
    expect(component).toBeTruthy();
  });

  /**
   * Regression tests for the org-switch bug introduced in PR #20067.
   *
   * Root cause: Angular reuses the VaultComponent instance when navigating between
   * organisations (same route definition), so ngOnInit does not re-run. After the
   * initial load the refreshingSubject$ BehaviorSubject is set to false. The guards
   *   filter(([,,,refreshing]) => refreshing)      — in allCiphers$
   *   filter((refreshing) => refreshing)           — in allCollectionsWithoutUnassigned$
   * then silently block every subsequent fetch triggered by organisation$ changing.
   *
   * Fix: subscribe to organizationId$.pipe(skip(1)) in the constructor and reset
   * refreshingSubject$ to true on every org switch, allowing the reactive chain to
   * re-fire for the new organisation.
   */
  describe("organization switching", () => {
    describe("given the initial load has completed (refreshingSubject$ is false)", () => {
      let allCiphersSubscription: Subscription;

      beforeEach(() => {
        // Subscribe to allCiphers$ to activate the reactive chain, mirroring what the
        // template async pipe does in production.
        allCiphersSubscription = (component as any).allCiphers$.subscribe();

        // Simulate the end of the initial load: in production the firstSetup$ chain in
        // ngOnInit calls refreshingSubject$.next(false) once allCollections$ emits.
        (component as any).refreshingSubject$.next(false);
      });

      afterEach(() => {
        allCiphersSubscription?.unsubscribe();
      });

      it("resets refreshingSubject$ to true so the allCiphers$ filter guard passes", () => {
        const nextSpy = jest.spyOn((component as any).refreshingSubject$, "next");

        filterSubject.next({ organizationId: ORG_B_ID });

        // Verify next(true) was called — the value may already have been reset to false
        // by the synchronous allCollections$ → firstSetup$ chain, but the important thing
        // is that the guard was lifted for the in-flight fetch.
        expect(nextSpy).toHaveBeenCalledWith(true);
      });

      it("re-fetches ciphers for the new organization", async () => {
        filterSubject.next({ organizationId: ORG_B_ID });

        // Allow the async switchMap inside allCiphers$ to resolve.
        await fixture.whenStable();

        expect(cipherService.getAllFromApiForOrganization).toHaveBeenCalledWith(ORG_B_ID);
      });

      it("does not re-fetch when the same organization is emitted again", () => {
        const callsBefore = cipherService.getAllFromApiForOrganization.mock.calls.length;

        // organizationId$ uses distinctUntilChanged(), so re-emitting the same ID must
        // not trigger a refresh (and must leave refreshingSubject$ as false).
        filterSubject.next({ organizationId: ORG_A_ID });

        expect(cipherService.getAllFromApiForOrganization.mock.calls.length).toBe(callsBefore);
        expect((component as any).refreshingSubject$.getValue()).toBe(false);
      });
    });
  });

  describe("addCipher", () => {
    beforeEach(() => {
      cipherFormConfigService.buildConfig.mockResolvedValue({} as CipherFormConfig);
      jest
        .spyOn(VaultItemDialogComponent, "open")
        .mockReturnValue({ closed: of(undefined) } as unknown as DialogRef<
          VaultItemDialogResult | undefined
        >);
    });

    it("passes the explicit cipherType to buildConfig when one is provided", async () => {
      await component.addCipher(CipherType.Card);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        CipherType.Card,
      );
    });

    it("falls back to activeFilter.cipherType when no cipherType is provided", async () => {
      component.activeFilter = { cipherType: CipherType.Login } as unknown as VaultFilter;

      await component.addCipher();

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        CipherType.Login,
      );
    });

    it("prefers the explicit cipherType over activeFilter.cipherType when both are set", async () => {
      component.activeFilter = { cipherType: CipherType.Login } as unknown as VaultFilter;

      await component.addCipher(CipherType.SecureNote);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        CipherType.SecureNote,
      );
    });
  });
});
