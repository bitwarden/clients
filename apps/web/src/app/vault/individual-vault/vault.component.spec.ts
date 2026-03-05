import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, Params, provideRouter, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, EMPTY, of, Subject } from "rxjs";
import { map } from "rxjs/operators";

import {
  CollectionAdminService,
  CollectionService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
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
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { MessageListener } from "@bitwarden/messaging";
import {
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterService,
  VaultFilter,
  VaultFilterServiceAbstraction,
  VaultItemEvent,
  VaultItemsTransferService,
} from "@bitwarden/vault";

import { OrganizationWarningsService } from "../../billing/organizations/warnings/services";
import { ProductSwitcherService } from "../../layouts/product-switcher/shared/product-switcher.service";
import {
  VaultItemDialogComponent,
  VaultItemDialogResult,
} from "../components/vault-item-dialog/vault-item-dialog.component";
import { VaultItemsComponent } from "../components/vault-items/vault-items.component";
import { WebVaultExtensionPromptService } from "../services/web-vault-extension-prompt.service";
import { WebVaultPromptService } from "../services/web-vault-prompt.service";
import { WelcomeDialogService } from "../services/welcome-dialog.service";

import { VaultBannersService } from "./vault-banners/services/vault-banners.service";
import { VaultOnboardingService } from "./vault-onboarding/services/abstraction/vault-onboarding.service";
import { VaultComponent } from "./vault.component";

const TEST_CIPHER_ID = "test-cipher-id";
const TEST_USER_ID = "test-user-id" as UserId;

describe("VaultComponent", () => {
  let component: VaultComponent<any>;
  let fixture: ComponentFixture<VaultComponent<any>>;
  let queryParamsSubject: BehaviorSubject<Params>;

  let mockCipher: Cipher;
  let openVaultItemDialogSpy: jest.SpyInstance;

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<Params>({});
    openVaultItemDialogSpy = jest.spyOn(VaultItemDialogComponent, "open").mockReturnValue({
      closed: new Subject<VaultItemDialogResult>(),
    } as unknown as DialogRef<VaultItemDialogResult, unknown>);

    openVaultItemDialogSpy.mockClear();

    mockCipher = {
      id: TEST_CIPHER_ID,
      reprompt: 0,
      type: CipherType.Login,
      edit: true,
    } as Cipher;

    const cipherServiceMock = mock<CipherService>();
    cipherServiceMock.get.mockResolvedValue(mockCipher);
    cipherServiceMock.cipherListViews$.mockReturnValue(of([]));
    cipherServiceMock.failedToDecryptCiphers$.mockReturnValue(of([]));

    const organizationServiceMock = mock<OrganizationService>();
    organizationServiceMock.organizations$.mockReturnValue(of([]));

    const collectionServiceMock = mock<CollectionService>();
    collectionServiceMock.decryptedCollections$.mockReturnValue(of([]));

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
      imports: [VaultComponent],
      providers: [
        provideRouter([]),
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: BroadcasterService, useValue: mock<BroadcasterService>() },
        {
          provide: VaultFilterServiceAbstraction,
          useValue: {
            ...mock<VaultFilterServiceAbstraction>(),
            collectionTree$: of(emptyTreeNode("collections")),
            folderTree$: of(emptyTreeNode("folders")),
            organizationTree$: of(emptyTreeNode("organizations")),
            cipherTypeTree$: of(emptyTreeNode("cipherTypes")),
            filteredCollections$: of([]),
          },
        },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: FolderService, useValue: mock<FolderService>() },
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
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: WelcomeDialogService, useValue: mock<WelcomeDialogService>() },
        { provide: OrganizationUserApiService, useValue: mock<OrganizationUserApiService>() },
        { provide: CollectionAdminService, useValue: mock<CollectionAdminService>() },
        { provide: CipherAuthorizationService, useValue: mock<CipherAuthorizationService>() },
        { provide: ProviderService, useValue: mock<ProviderService>() },
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
        { provide: RestrictedItemTypesService, useValue: { restricted$: of([]) } },
        {
          provide: CipherArchiveService,
          useValue: {
            hasArchiveFlagEnabled$: of(false),
            userCanArchive$: jest.fn().mockReturnValue(of(false)),
            showSubscriptionEndedMessaging$: jest.fn().mockReturnValue(of(false)),
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
      .overrideComponent(VaultComponent, {
        set: {
          providers: [
            {
              provide: RoutedVaultFilterService,
              useValue: { filter$: of({}) },
            },
            {
              provide: RoutedVaultFilterBridgeService,
              useValue: {
                activeFilter$: of(new VaultFilter()),
                navigate: jest.fn(),
              },
            },
            {
              provide: DefaultCipherFormConfigService,
              useValue: {
                buildConfig: jest.fn().mockImplementation((mode) =>
                  Promise.resolve({
                    mode,
                    cipherType: mockCipher.type,
                    admin: false,
                    organizationDataOwnershipDisabled: true,
                    originalCipher: mockCipher,
                    collections: [],
                    organizations: [],
                    folders: [],
                  }),
                ),
              },
            },
            {
              provide: WebVaultPromptService,
              useValue: { conditionallyPromptUser: jest.fn() },
            },
            {
              provide: VaultItemsTransferService,
              useValue: mock<VaultItemsTransferService>(),
            },
          ],
        },
      })
      .overrideProvider(VaultBannersService, {
        useValue: mock<VaultBannersService>(),
      })
      .compileComponents();

    fixture = TestBed.createComponent(VaultComponent);
    component = fixture.componentInstance;
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });

  [
    { action: "view", formDetails: { mode: "view", formMode: "edit" } },
    { action: "edit", eventName: "editCipher", formDetails: { mode: "form", formMode: "edit" } },
    { action: "clone", eventName: "clone", formDetails: { mode: "form", formMode: "clone" } },
  ].forEach(({ action, eventName, formDetails }) => {
    describe(`${action} cipher`, () => {
      it(`${action}s cipher when from action query param when initializing`, async () => {
        queryParamsSubject.next({ action, itemId: TEST_CIPHER_ID });
        // recreate component to trigger constructor logic
        fixture = TestBed.createComponent(VaultComponent);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(openVaultItemDialogSpy).toHaveBeenCalled();

        const params = openVaultItemDialogSpy.mock.lastCall[1];
        expect(params.mode).toBe(formDetails.mode);
        expect(params.formConfig.mode).toBe(formDetails.formMode);
      });

      it(`${action}s cipher when from action query param when query param changes`, async () => {
        queryParamsSubject.next({});
        // recreate component to trigger constructor logic
        fixture = TestBed.createComponent(VaultComponent);
        fixture.detectChanges();

        expect(openVaultItemDialogSpy).not.toHaveBeenCalled();

        queryParamsSubject.next({ action, cipherId: TEST_CIPHER_ID });
        fixture.detectChanges();
        await fixture.whenStable();

        expect(openVaultItemDialogSpy).toHaveBeenCalled();
      });

      if (eventName) {
        it(`${action}s cipher from ${eventName} event`, async () => {
          const vaultItemsComponent = fixture.debugElement.query(By.directive(VaultItemsComponent))
            .componentInstance as VaultItemsComponent<CipherViewLike>;

          vaultItemsComponent.onEvent.emit({
            type: eventName,
            item: { id: TEST_CIPHER_ID },
          } as unknown as VaultItemEvent<CipherViewLike>);
          fixture.detectChanges();
          await fixture.whenStable();

          expect(openVaultItemDialogSpy).toHaveBeenCalled();
        });
      }

      describe("password reprompt", () => {
        let promptSpy: jest.SpyInstance;
        let navigateSpy: jest.SpyInstance;

        beforeEach(async () => {
          const passwordRepromptService = TestBed.inject(PasswordRepromptService);
          const router = TestBed.inject(Router);
          navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);
          promptSpy = jest
            .spyOn(passwordRepromptService, "showPasswordPrompt")
            .mockResolvedValue(true);

          mockCipher.reprompt = 1; // Require reprompt
          queryParamsSubject.next({ action, itemId: TEST_CIPHER_ID });
        });

        it("prompts the user for password reprompt if the cipher requires reprompt", async () => {
          fixture = TestBed.createComponent(VaultComponent);
          fixture.detectChanges();
          await fixture.whenStable();

          expect(promptSpy).toHaveBeenCalled();
        });

        it("resets the params when the user fails reprompt", async () => {
          promptSpy.mockResolvedValueOnce(false);

          fixture = TestBed.createComponent(VaultComponent);
          fixture.detectChanges();
          await fixture.whenStable();

          const params = navigateSpy.mock.calls[0][1];
          expect(params).toMatchObject({
            queryParams: {
              action: null,
              cipherId: null,
              itemId: null,
            },
          });
        });
      });
    });
  });
});
