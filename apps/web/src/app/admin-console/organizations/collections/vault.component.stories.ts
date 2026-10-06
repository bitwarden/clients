// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import "../../../billing/organizations/change-plan-dialog.component";

import { importProvidersFrom, signal } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { CollectionAdminService, CollectionService } from "@bitwarden/admin-console/common";
import { LogoutService } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  DialogService,
  LayoutComponent,
  StorybookGlobalStateProvider,
  ToastService,
} from "@bitwarden/components";
import { MessageListener, MessageSender } from "@bitwarden/messaging";
import { GlobalStateProvider } from "@bitwarden/state";
import { ShareLinkService } from "@bitwarden/tools-share";
import { LockService } from "@bitwarden/unlock";
import { PasswordRepromptService, Vfo1TerminologyService } from "@bitwarden/vault";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import { PreloadedEnglishI18nModule } from "../../../core/tests";
import { CoachmarkService } from "../../../vault/components/coachmark";
import { GroupApiService, GroupView } from "../core";

import { VaultComponent } from "./vault.component";

function mockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1" as OrganizationId,
    name: "Acme Corp",
    enabled: true,
    isMember: true,
    isProviderUser: false,
    canEditAnyCollection: true,
    canEditAllCiphers: true,
    canCreateNewCollections: true,
    canDeleteAnyCollection: true,
    canEditUnassignedCiphers: true,
    canEditUnmanagedCollections: true,
    allowAdminAccessToAllCollectionItems: true,
    useGroups: true,
    useEvents: false,
    canAccessEventLogs: false,
    type: OrganizationUserType.Owner,
    permissions: new PermissionsApi(),
    ...overrides,
  } as unknown as Organization;
}

function mockCollection(
  name: string,
  id: string,
  orgId: OrganizationId = "org-1" as OrganizationId,
): CollectionAdminView {
  const col = new CollectionAdminView({ id: id as CollectionId, organizationId: orgId, name });
  col.manage = true;
  col.assigned = true;
  return col;
}

function mockCipher(
  i: number,
  organizationId: OrganizationId,
  collectionId: CollectionId,
): CipherView {
  const cipher = new CipherView();
  cipher.id = `cipher-${i}`;
  cipher.name = `Vault item ${i}`;
  cipher.type = CipherType.Login;
  cipher.organizationId = organizationId;
  cipher.collectionIds = [collectionId];
  cipher.login = new LoginView();
  cipher.login.username = `user-${i}@example.com`;
  cipher.edit = true;
  cipher.viewPassword = true;
  return cipher;
}

const organization = mockOrganization();
const collections = [
  mockCollection("Engineering", "col-1"),
  mockCollection("Marketing", "col-2"),
  mockCollection("Design", "col-3"),
  mockCollection("Finance", "col-4"),
  mockCollection("Customer Support", "col-5"),
];
const ciphers = [
  mockCipher(1, organization.id as OrganizationId, "col-1" as CollectionId),
  mockCipher(2, organization.id as OrganizationId, "col-1" as CollectionId),
  mockCipher(3, organization.id as OrganizationId, "col-2" as CollectionId),
  mockCipher(4, organization.id as OrganizationId, "col-3" as CollectionId),
];
const groups: GroupView[] = [
  new GroupView({ id: "group-1", name: "Group 1", organizationId: organization.id }),
];

/** Renders the story at `url`; hash routing keeps Storybook's own query string intact. */
const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

const mockOrganizationService: Partial<OrganizationService> = {
  organizations$: () => of([organization]),
  memberOrganizations$: () => of([organization]),
};

/** Pulled in transitively by ProductSwitcherService (providedIn: root), unrelated to vault
 * rendering itself. */
const mockProviderService: Partial<ProviderService> = {
  providers$: () => of([]),
};

const mockPolicyService: Partial<PolicyService> = {
  policies$: () => of([]),
  policiesByType$: () => of([]),
  policyAppliesToUser$: () => of(false),
};

const mockAccountService: Partial<AccountService> = {
  activeAccount$: of({
    id: "user-1",
    email: "user@example.com",
    name: "Story User",
    emailVerified: true,
  }) as unknown as AccountService["activeAccount$"],
};

const mockCipherService: Partial<CipherService> = {
  getAllFromApiForOrganization: () => Promise.resolve(ciphers),
  getManyFromApiForOrganization: () => Promise.resolve(ciphers),
};

const mockSearchService: Partial<SearchService> = {
  isSearchable: () => Promise.resolve(false),
  searchCiphers: (async (_userId: unknown, _organizationId: unknown, _query: unknown, c: unknown) =>
    c) as SearchService["searchCiphers"],
};

const mockGroupApiService: Partial<GroupApiService> = {
  getAll: () => Promise.resolve(groups),
};

const mockRestrictedItemTypesService: Partial<RestrictedItemTypesService> = {
  restricted$: of([]),
  isCipherRestricted: () => false,
};

const mockSyncService: Partial<SyncService> = {
  fullSync: () => Promise.resolve(true),
  getLastSync: () => Promise.resolve(new Date()),
};

/** Needed by VaultHeaderComponent, which VaultComponent renders. */
const mockVaultTimeoutSettingsService: Partial<VaultTimeoutSettingsService> = {
  availableVaultTimeoutActions$: () => of([]),
};

const mockLogoutService: Partial<LogoutService> = {
  logout: () => Promise.resolve(undefined),
};

const mockLockService: Partial<LockService> = {
  lock: () => Promise.resolve(),
};

const mockCollectionAdminService: Partial<CollectionAdminService> = {
  collectionAdminViews$: () => of(collections),
};

const mockCollectionService: Partial<CollectionService> = {
  delete: () => Promise.resolve(),
  decryptedCollections$: () => of([]),
  groupByOrganization: () => new Map(),
};

const mockOrganizationWarningsService: Partial<OrganizationWarningsService> = {
  showInactiveSubscriptionDialog$: () => of(undefined),
  showSubscribeBeforeFreeTrialEndsDialog$: () => of(undefined),
  getFreeTrialWarning$: () => of(null),
  getResellerRenewalWarning$: () => of(null),
} as unknown as Partial<OrganizationWarningsService>;

const mockCipherAuthorizationService: Partial<CipherAuthorizationService> = {
  canDeleteCipher$: () => of(true),
  canRestoreCipher$: () => of(true),
  canCloneCipher$: () => of(true),
};

const mockVfo1TerminologyService: Partial<Vfo1TerminologyService> = {
  enabled: signal(false),
  iconClass: (iconClass) => iconClass,
  collectionQueryParams: (collectionId) => ({
    collectionId: collectionId ?? null,
    sharedFolderId: null,
  }),
};

/**
 * VaultFilterModule (imported by VaultComponent) provides VaultFilterServiceAbstraction with its
 * own concrete class at VaultComponent's own injector level, which no story-level provider can
 * override from outside (component/module-folded providers always win over providers from a
 * parent injector, including route-level ones). So the real service is left to construct, and
 * its own dependencies are mocked here instead.
 */
const mockFolderService: Partial<FolderService> = {
  folderViews$: () => of([]),
};

/** Covers the one `stateProvider.getUser(...)` call VaultFilterService makes, for its
 * collapsed-groupings state. */
const mockStateProvider: Partial<StateProvider> = {
  getUser: ((_userId: unknown, _keyDefinition: unknown) => ({
    state$: of([] as string[]),
    update: () => Promise.resolve([] as string[]),
  })) as unknown as StateProvider["getUser"],
};

/** Avoids constructing the real service, which needs PolicyService/StateProvider/etc. */
const mockCoachmarkService: Partial<CoachmarkService> = {
  activeStepId: signal(null),
  currentStepNumber: signal(0),
  totalSteps: signal(0),
  isStepActive: () => false,
  getStepPosition: () => undefined,
  getStepTitle: () => "",
  getStepDescription: () => "",
  getStepLearnMoreUrl: () => undefined,
  previousStep: () => Promise.resolve(),
  nextStep: () => Promise.resolve(),
  completeTour: () => Promise.resolve(),
};

// The rest of these mocks match the ones already established for VaultItemsComponent (which
// VaultComponent renders) in apps/web/src/app/vault/components/vault-items/vault-items.stories.ts.
const mockEnvironmentService: Partial<EnvironmentService> = {
  environment$: of({ getIconsUrl: () => "" } as Environment),
};

const mockDomainSettingsService: Partial<DomainSettingsService> = {
  showFavicons$: of(true),
};

const mockAvatarService: Partial<AvatarService> = {
  avatarColor$: of("#FF0000"),
};

const mockTokenService: Partial<TokenService> = {
  getUserId: () => Promise.resolve("user-1" as UserId),
  getName: () => Promise.resolve("Story User"),
  getEmail: () => Promise.resolve("user@example.com"),
};

const mockPremiumUpgradePromptService: Partial<PremiumUpgradePromptService> = {
  promptForPremium: () => Promise.resolve(),
};

const mockBillingAccountProfileStateService: Partial<BillingAccountProfileStateService> = {
  hasPremiumFromAnySource$: () => of(false),
  hasPremiumPersonally$: () => of(false),
  hasPremiumFromAnyOrganization$: () => of(false),
};

const mockShareLinkService: Partial<ShareLinkService> = {
  cipherCanBeShared$: () => of(false),
};

const mockCipherArchiveService: Partial<CipherArchiveService> = {
  archivedCiphers$: () => of([]),
  userCanArchive$: () => of(false),
  userHasPremium$: () => of(false),
  showSubscriptionEndedMessaging$: () => of(false),
};

/**
 * Mirrors `vault-routing.module.ts` (minus its guard) so the page reads `organizationId` from a
 * real route param. A stubbed `ActivatedRoute` can't build the relative links this page and its
 * children render; see .claude/rules/storybook-routing.md.
 *
 * VaultFilterServiceAbstraction can't be mocked from here: VaultComponent imports
 * VaultFilterModule, which re-provides that token with its own concrete class at VaultComponent's
 * own injector level, and no provider from an outer injector (route-level included) can override
 * a component's own module-folded providers. So the real VaultFilterService (admin-console's
 * local subclass) is left to construct for real; its constructor dependencies are mocked in
 * rootProviders instead (see mockFolderService, mockPolicyService, etc. above).
 */
const routes: Routes = [
  {
    path: "organizations/:organizationId/vault",
    children: [{ path: "", component: VaultComponent }],
  },
];

const rootProviders = [
  { provide: OrganizationService, useValue: mockOrganizationService },
  { provide: ProviderService, useValue: mockProviderService },
  { provide: AccountService, useValue: mockAccountService },
  { provide: CipherService, useValue: mockCipherService },
  { provide: SearchService, useValue: mockSearchService },
  { provide: GroupApiService, useValue: mockGroupApiService },
  { provide: RestrictedItemTypesService, useValue: mockRestrictedItemTypesService },
  { provide: SyncService, useValue: mockSyncService },
  { provide: VaultTimeoutSettingsService, useValue: mockVaultTimeoutSettingsService },
  { provide: LogoutService, useValue: mockLogoutService },
  { provide: LockService, useValue: mockLockService },
  { provide: CollectionAdminService, useValue: mockCollectionAdminService },
  { provide: CollectionService, useValue: mockCollectionService },
  { provide: OrganizationWarningsService, useValue: mockOrganizationWarningsService },
  { provide: CipherAuthorizationService, useValue: mockCipherAuthorizationService },
  { provide: Vfo1TerminologyService, useValue: mockVfo1TerminologyService },
  {
    provide: PasswordRepromptService,
    useValue: { protectedFields: (): string[] => [] },
  },
  { provide: MessageListener, useValue: { allMessages$: of({}) } },
  { provide: MessageSender, useValue: { send: () => {} } },
  { provide: CipherArchiveService, useValue: mockCipherArchiveService },
  { provide: BillingApiServiceAbstraction, useValue: {} },
  { provide: ApiService, useValue: {} },
  {
    provide: PlatformUtilsService,
    useValue: { isSelfHost: () => false, copyToClipboard: () => {} },
  },
  { provide: LogService, useValue: { error: () => {}, info: () => {} } },
  { provide: DialogService, useValue: {} },
  { provide: ToastService, useValue: { showToast: () => {} } },
  { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
  { provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider },
  { provide: CoachmarkService, useValue: mockCoachmarkService },
  { provide: PolicyService, useValue: mockPolicyService },
  { provide: FolderService, useValue: mockFolderService },
  { provide: StateProvider, useValue: mockStateProvider },
  { provide: EnvironmentService, useValue: mockEnvironmentService },
  { provide: DomainSettingsService, useValue: mockDomainSettingsService },
  { provide: AvatarService, useValue: mockAvatarService },
  { provide: TokenService, useValue: mockTokenService },
  { provide: PremiumUpgradePromptService, useValue: mockPremiumUpgradePromptService },
  { provide: BillingAccountProfileStateService, useValue: mockBillingAccountProfileStateService },
  { provide: ShareLinkService, useValue: mockShareLinkService },
  { provide: TotpService, useValue: {} },
  { provide: EventCollectionService, useValue: {} },
];

export default {
  title: "Admin Console/Organizations/Collections/Vault",
  component: VaultComponent,
  decorators: [
    atUrl(`/organizations/${organization.id}/vault?collectionId=col-1`),
    moduleMetadata({
      imports: [RouterOutlet, LayoutComponent],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        ...rootProviders,
      ],
    }),
  ],
} satisfies Meta<VaultComponent>;

type Story = StoryObj<VaultComponent>;

/** Org vault, loaded, with a couple of collections and ciphers. */
export const Default: Story = {
  render: () => ({
    template: `<bit-layout style="height: 800px">
    <router-outlet></router-outlet>
  </bit-layout>`,
  }),
};
