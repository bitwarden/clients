import { SelectionModel } from "@angular/cdk/collections";
import { NO_ERRORS_SCHEMA, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Params, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, EMPTY, of } from "rxjs";
import { map } from "rxjs/operators";

import {
  CollectionAdminService,
  CollectionService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { AuthRequestServiceAbstraction, LockService, LogoutService } from "@bitwarden/auth/common";
import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService, ScrollLayoutService, ToastService } from "@bitwarden/components";
import { MessageListener } from "@bitwarden/messaging";
import {
  ASSIGN_COLLECTIONS_DIALOG,
  AssignCollectionsDialogRef,
  AssignCollectionsResult,
  BULK_DELETE_DIALOG,
  BulkDeleteDialogRef,
  BulkDeleteDialogResult,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterService,
  VaultBatchBarService,
  VaultFilter,
  VaultFilterServiceAbstraction,
  VaultItem,
  VaultItemsTransferService,
} from "@bitwarden/vault";

import { OrganizationWarningsService } from "../../billing/organizations/warnings/services";
import { ProductSwitcherService } from "../../layouts/product-switcher/shared/product-switcher.service";
import { WebVaultExtensionPromptService } from "../services/web-vault-extension-prompt.service";
import { WebVaultPromptService } from "../services/web-vault-prompt.service";
import { WelcomeDialogService } from "../services/welcome-dialog.service";

import { VaultBannersService } from "./vault-banners/services/vault-banners.service";
import { VaultNextComponent } from "./vault-next.component";
import { VaultOnboardingService } from "./vault-onboarding/services/abstraction/vault-onboarding.service";

const TEST_USER_ID = "test-user-id" as UserId;

/** A row the table would render, standing in for a decrypted cipher. */
const login = (overrides: Partial<CipherView> = {}) =>
  ({
    id: "cipher-1",
    name: "GitHub",
    type: CipherType.Login,
    favorite: false,
    reprompt: 0,
    ...overrides,
  }) as CipherView;

describe("VaultNextComponent", () => {
  let component: VaultNextComponent<CipherView>;
  let fixture: ComponentFixture<VaultNextComponent<CipherView>>;
  let userCanArchive$: BehaviorSubject<boolean>;
  let cipherListViews$: BehaviorSubject<CipherView[]>;
  let restricted$: BehaviorSubject<unknown[]>;

  /**
   * Reads the row-action ids the component currently offers. The actions are `protected`, so the
   * cast is how a spec reaches them without widening the component's API.
   */
  const actionIds = () =>
    (component as unknown as { rowActions: () => { id: string }[] }).rowActions().map((a) => a.id);

  const rows = () => (component as unknown as { rows: () => CipherView[] }).rows();

  beforeEach(async () => {
    userCanArchive$ = new BehaviorSubject<boolean>(false);
    cipherListViews$ = new BehaviorSubject<CipherView[]>([]);
    restricted$ = new BehaviorSubject<unknown[]>([]);

    const queryParamsSubject = new BehaviorSubject<Params>({});

    const mockCipher = {
      id: "cipher-1",
      reprompt: 0,
      type: CipherType.Login,
      edit: true,
    } as Cipher;

    const cipherServiceMock = mock<CipherService>();
    cipherServiceMock.get.mockResolvedValue(mockCipher);
    cipherServiceMock.cipherListViews$.mockReturnValue(cipherListViews$ as any);
    cipherServiceMock.failedToDecryptCiphers$.mockReturnValue(of([]) as any);

    const organizationServiceMock = mock<OrganizationService>();
    organizationServiceMock.organizations$.mockReturnValue(of([]) as any);

    const collectionServiceMock = mock<CollectionService>();
    collectionServiceMock.decryptedCollections$.mockReturnValue(of([]) as any);

    const folderServiceMock = mock<FolderService>();
    folderServiceMock.folderViews$.mockReturnValue(of([]) as any);

    const billingMock = mock<BillingAccountProfileStateService>();
    billingMock.hasPremiumFromAnySource$.mockReturnValue(of(false));

    const policyServiceMock = mock<PolicyService>();
    policyServiceMock.policyAppliesToUser$.mockReturnValue(of(false));
    policyServiceMock.policiesByType$.mockReturnValue(of([]));

    const mockActivatedRoute = {
      queryParams: queryParamsSubject.asObservable(),
      params: of({}),
      queryParamMap: queryParamsSubject.pipe(map((p) => convertToParamMap(p))),
      paramMap: of(convertToParamMap({})),
      data: of({}),
    };

    const emptyTreeNode = (name: string) => new TreeNode({ id: "", name } as any, null);

    await TestBed.configureTestingModule({
      imports: [VaultNextComponent],
      providers: [
        provideRouter([]),
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: BroadcasterService, useValue: mock<BroadcasterService>() },
        {
          provide: VaultFilterServiceAbstraction,
          useValue: {
            ...mock<VaultFilterServiceAbstraction>(),
            clearOrganizationFilter: jest.fn(),
            collectionTree$: of(emptyTreeNode("collections")),
            folderTree$: of(emptyTreeNode("folders")),
            organizationTree$: of(emptyTreeNode("organizations")),
            cipherTypeTree$: of(emptyTreeNode("cipherTypes")),
            filteredCollections$: of([]),
          },
        },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: FolderService, useValue: folderServiceMock },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: TotpService, useValue: mock<TotpService>() },
        { provide: EventCollectionService, useValue: mock<EventCollectionService>() },
        { provide: SearchService, useValue: mock<SearchService>() },
        { provide: SearchPipe, useValue: mock<SearchPipe>() },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: BillingApiServiceAbstraction, useValue: mock<BillingApiServiceAbstraction>() },
        { provide: OrganizationWarningsService, useValue: mock<OrganizationWarningsService>() },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        { provide: SyncService, useValue: mock<SyncService>() },
        { provide: ScrollLayoutService, useValue: mock<ScrollLayoutService>() },
        {
          provide: ConfigService,
          useValue: {
            ...mock<ConfigService>(),
            getFeatureFlag$: jest.fn().mockReturnValue(of(false)),
          },
        },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: WelcomeDialogService, useValue: mock<WelcomeDialogService>() },
        { provide: OrganizationUserApiService, useValue: mock<OrganizationUserApiService>() },
        { provide: CollectionAdminService, useValue: mock<CollectionAdminService>() },
        { provide: CipherAuthorizationService, useValue: mock<CipherAuthorizationService>() },
        { provide: ProviderService, useValue: mock<ProviderService>() },
        { provide: LogoutService, useValue: mock<LogoutService>() },
        { provide: LockService, useValue: mock<LockService>() },
        {
          provide: AvatarService,
          useValue: { ...mock<AvatarService>(), avatarColor$: of(null) },
        },
        {
          provide: StateProvider,
          useValue: {
            ...mock<StateProvider>(),
            getUser: jest.fn().mockReturnValue({ update: jest.fn(), state$: of({}) }),
          },
        },
        {
          provide: OrganizationApiServiceAbstraction,
          useValue: mock<OrganizationApiServiceAbstraction>(),
        },
        {
          provide: AuthRequestServiceAbstraction,
          useValue: mock<AuthRequestServiceAbstraction>(),
        },
        {
          provide: AutomaticUserConfirmationService,
          useValue: mock<AutomaticUserConfirmationService>(),
        },
        {
          provide: WebVaultExtensionPromptService,
          useValue: mock<WebVaultExtensionPromptService>(),
        },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: CipherService, useValue: cipherServiceMock },
        { provide: CollectionService, useValue: collectionServiceMock },
        { provide: BillingAccountProfileStateService, useValue: billingMock },
        { provide: OrganizationService, useValue: organizationServiceMock },
        { provide: PolicyService, useValue: policyServiceMock },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: MessageListener, useValue: { allMessages$: EMPTY } },
        {
          provide: VaultOnboardingService,
          useValue: { vaultOnboardingState$: jest.fn().mockReturnValue({ state$: of([]) }) },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: TEST_USER_ID,
              email: "test@test.com",
              emailVerified: true,
              name: "Test",
            }),
          },
        },
        {
          provide: RestrictedItemTypesService,
          useValue: {
            restricted$,
            // Restriction is keyed off the type list the spec pushes into `restricted$`.
            isCipherRestricted: (cipher: CipherView, restricted: { cipherType: CipherType }[]) =>
              restricted.some((r) => r.cipherType === cipher.type),
          },
        },
        {
          provide: CipherArchiveService,
          useValue: {
            userCanArchive$: jest.fn().mockReturnValue(userCanArchive$),
            showSubscriptionEndedMessaging$: jest.fn().mockReturnValue(of(false)),
            archivedCiphers$: jest.fn().mockReturnValue(of([])),
            userHasPremium$: jest.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: VaultTimeoutSettingsService,
          useValue: { availableVaultTimeoutActions$: () => of([]) },
        },
        {
          provide: ProductSwitcherService,
          useValue: {
            products$: of({ bento: [], other: [] }),
            organizations$: of([]),
            providers$: of([]),
          },
        },
        {
          provide: VaultProfileService,
          useValue: { getProfileCreationDate: jest.fn().mockResolvedValue(new Date()) },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // Note: TestBed supplies the component-level providers itself, so this suite cannot catch a
      // subclass that forgets to declare VAULT_COMPONENT_PROVIDERS — that surfaces only when the
      // real app builds the component (NG0201). Verified separately against the AOT build.
      .overrideComponent(VaultNextComponent, {
        set: {
          providers: [
            { provide: RoutedVaultFilterService, useValue: { filter$: of({}) } },
            {
              provide: RoutedVaultFilterBridgeService,
              useValue: { activeFilter$: of(new VaultFilter()), navigate: jest.fn() },
            },
            {
              provide: DefaultCipherFormConfigService,
              useValue: { buildConfig: jest.fn().mockResolvedValue({}) },
            },
            { provide: WebVaultPromptService, useValue: { conditionallyPromptUser: jest.fn() } },
            { provide: VaultItemsTransferService, useValue: mock<VaultItemsTransferService>() },
            {
              provide: VaultBatchBarService,
              useValue: {
                completed$: EMPTY,
                selection: new SelectionModel<VaultItem<any>>(true, [], true),
                setConfig: jest.fn(),
                enabled: signal(false),
                barVisible: signal(false),
              },
            },
            {
              provide: ASSIGN_COLLECTIONS_DIALOG,
              useValue: {
                open: jest.fn().mockResolvedValue(AssignCollectionsResult.Canceled),
              } satisfies AssignCollectionsDialogRef,
            },
            {
              provide: BULK_DELETE_DIALOG,
              useValue: {
                open: jest.fn().mockResolvedValue(BulkDeleteDialogResult.Canceled),
              } satisfies BulkDeleteDialogRef,
            },
          ],
        },
      })
      .overrideProvider(VaultBannersService, { useValue: mock<VaultBannersService>() })
      .compileComponents();

    fixture = TestBed.createComponent(VaultNextComponent<CipherView>);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });

  describe("rows", () => {
    it("exposes the user's ciphers", () => {
      cipherListViews$.next([login()]);
      expect(rows().map((c) => c.id)).toEqual(["cipher-1"]);
    });

    it("drops ciphers whose type the policy restricts", () => {
      restricted$.next([{ cipherType: CipherType.Card }]);
      cipherListViews$.next([login(), login({ id: "cipher-2", type: CipherType.Card })]);

      expect(rows().map((c) => c.id)).toEqual(["cipher-1"]);
    });
  });

  describe("rowActions", () => {
    it("offers the standard actions", () => {
      expect(actionIds()).toEqual([
        "favorite",
        "unfavorite",
        "edit",
        "attachments",
        "clone",
        "assignToCollections",
        "delete",
      ]);
    });

    it("adds archive once the user can archive", () => {
      userCanArchive$.next(true);
      expect(actionIds()).toContain("archive");
    });

    it("keeps delete last so the danger action stays at the bottom of the menu", () => {
      userCanArchive$.next(true);
      expect(actionIds().at(-1)).toBe("delete");
    });

    it("shows favorite only for unfavorited items, and unfavorite only for favorited ones", () => {
      const actions = (
        component as unknown as {
          rowActions: () => { id: string; show?: (item: CipherView) => boolean }[];
        }
      ).rowActions();
      const favorite = actions.find((a) => a.id === "favorite")!;
      const unfavorite = actions.find((a) => a.id === "unfavorite")!;

      expect(favorite.show!(login({ favorite: false }))).toBe(true);
      expect(favorite.show!(login({ favorite: true }))).toBe(false);
      expect(unfavorite.show!(login({ favorite: true }))).toBe(true);
      expect(unfavorite.show!(login({ favorite: false }))).toBe(false);
    });

    it("builds events the base class's dispatcher understands", () => {
      const actions = (
        component as unknown as {
          rowActions: () => { id: string; event: (item: CipherView) => unknown }[];
        }
      ).rowActions();
      const item = login();

      expect(actions.find((a) => a.id === "edit")!.event(item)).toEqual({
        type: "editCipher",
        item,
      });
      expect(actions.find((a) => a.id === "delete")!.event(item)).toEqual({
        type: "delete",
        items: [{ cipher: item }],
      });
      expect(actions.find((a) => a.id === "assignToCollections")!.event(item)).toEqual({
        type: "assignToCollections",
        items: [item],
      });
    });
  });

  describe("itemAction", () => {
    it("opens the item for editing when a row's name is activated", () => {
      const item = login();
      expect(
        (component as unknown as { itemAction: (item: CipherView) => unknown }).itemAction(item),
      ).toEqual({ type: "editCipher", item });
    });
  });
});
