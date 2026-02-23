import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import {
  BillingAccountProfileStateService,
  BillingApiServiceAbstraction,
} from "@bitwarden/common/billing/abstractions";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { Guid, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService, ScrollLayoutHostDirective, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { MemberAccessReportComponent } from "./member-access-report.component";
import { MemberAccessReportApiService } from "./services/member-access-report-api.service";
import { MemberAccessReportService } from "./services/member-access-report.service";
import { MemberAccessReportView } from "./view/member-access-report.view";

// ============================================================================
// Mock Data Factory Functions
// ============================================================================

function createMockMember(index: number): MemberAccessReportView {
  const names = ["Alice Johnson", "Bob Smith", "Carol Williams", "David Brown", "Eve Martinez"];
  const colors = ["#175ddc", "#7c5cdb", "#c93d63", "#d1860a", "#178d5c"];

  return {
    userGuid: `user-${index}` as Guid,
    name: names[index % names.length] || `User ${index}`,
    email: `user${index}@example.com`,
    avatarColor: colors[index % colors.length],
    collectionsCount: ((index * 3) % 10) + 1, // Deterministic: 1-10
    groupsCount: ((index * 2) % 5) + 1, // Deterministic: 1-5
    itemsCount: ((index * 17) % 200) + 1, // Deterministic: 1-200
    usesKeyConnector: index % 2 === 0, // Deterministic: alternating true/false
  };
}

const mockMemberData: MemberAccessReportView[] = [...Array(5).keys()].map(createMockMember);
const mockOrganizationId = "org-123" as OrganizationId;

// ============================================================================
// Mock Service Classes
// ============================================================================

class MockPlatformUtilsService implements Partial<PlatformUtilsService> {
  getApplicationVersion = () => Promise.resolve("2024.1.0");
  getClientType = () => ClientType.Web;
  isSelfHost = () => false;
}

export default {
  title: "DIRT/Reports/Member Access Report",
  component: MemberAccessReportComponent,
  decorators: [
    componentWrapperDecorator(
      (story) =>
        `<div bitScrollLayoutHost class="tw-flex tw-flex-col tw-h-screen tw-p-6 tw-overflow-auto">${story}</div>`,
    ),
    moduleMetadata({
      imports: [ScrollLayoutHostDirective],
      providers: [],
    }),
    applicationConfig({
      providers: [
        // I18n and Routing
        importProvidersFrom(PreloadedEnglishI18nModule),
        importProvidersFrom(RouterModule.forRoot([], { useHash: true })),

        // Platform Services
        { provide: PlatformUtilsService, useClass: MockPlatformUtilsService },
        { provide: LogService, useValue: { error: () => {}, warning: () => {}, info: () => {} } },
        { provide: MessagingService, useValue: { send: () => {} } },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: () => of(false), serverConfig$: of({}) },
        },

        // Member Access Report Services
        {
          provide: MemberAccessReportService,
          useValue: {
            generateMemberAccessReportViewV2: () => Promise.resolve(mockMemberData),
            generateUserReportExportItemsV2: () => Promise.resolve([]),
          },
        },
        { provide: MemberAccessReportApiService, useValue: {} },

        // File and Dialog Services
        { provide: FileDownloadService, useValue: { download: () => {} } },
        { provide: DialogService, useValue: { open: () => ({ closed: of(null) }) } },
        { provide: ToastService, useValue: { showToast: () => {} } },
        {
          provide: UserNamePipe,
          useValue: {
            transform: (user: { name?: string; email?: string }) => user.name || user.email,
          },
        },

        // Billing Services
        { provide: BillingApiServiceAbstraction, useValue: {} },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: () => of(false) },
        },
        {
          provide: OrganizationMetadataServiceAbstraction,
          useValue: { getOrganizationMetadata$: () => of({ isOnSecretsManagerStandalone: false }) },
        },

        // Encryption and Key Services
        { provide: EncryptService, useValue: {} },
        { provide: KeyService, useValue: {} },

        // Admin Console Services
        { provide: CollectionAdminService, useValue: {} },
        { provide: OrganizationUserApiService, useValue: {} },
        { provide: OrganizationService, useValue: { organizations$: () => of([]) } },
        { provide: PolicyService, useValue: { policyAppliesToUser$: () => of(false) } },
        { provide: ProviderService, useValue: { providers$: () => of([]) } },

        // Vault Services
        { provide: CipherService, useValue: {} },
        {
          provide: VaultTimeoutSettingsService,
          useValue: {
            availableVaultTimeoutActions$: () =>
              new BehaviorSubject([VaultTimeoutAction.Lock]).asObservable(),
          },
        },

        // State and Account Services
        {
          provide: StateService,
          useValue: {
            activeAccount$: of("account-123"),
            accounts$: of({ "account-123": { profile: { name: "Test User" } } }),
          },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: "account-123",
              name: "Test User",
              email: "test@example.com",
            }),
          },
        },
        { provide: AvatarService, useValue: { avatarColor$: of("#175ddc") } },
        { provide: SyncService, useValue: { getLastSync: () => Promise.resolve(new Date()) } },

        // Router
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ organizationId: mockOrganizationId }),
            queryParams: of({}),
            data: of({ titleId: "memberAccessReport" }), // Provides title for app-header
            fragment: of(null),
            url: of([]),
            paramMap: of({
              get: (key: string): string | null =>
                key === "organizationId" ? mockOrganizationId : null,
              has: (key: string): boolean => key === "organizationId",
              keys: ["organizationId"],
            }),
            queryParamMap: of({
              get: (): string | null => null,
              has: (): boolean => false,
              keys: [],
            }),
          },
        },
      ],
    }),
  ],
} as Meta<MemberAccessReportComponent>;

type Story = StoryObj<MemberAccessReportComponent>;

export const Default: Story = {};

export const Loading: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: MemberAccessReportService,
          useValue: {
            generateMemberAccessReportViewV2: () =>
              new Promise(() => {
                /* Never resolves to show loading state */
              }),
            generateUserReportExportItemsV2: () => Promise.resolve([]),
          },
        },
      ],
    }),
  ],
};

export const EmptyState: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: MemberAccessReportService,
          useValue: {
            generateMemberAccessReportViewV2: () => Promise.resolve([]),
            generateUserReportExportItemsV2: () => Promise.resolve([]),
          },
        },
      ],
    }),
  ],
};

export const WithManyMembers: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: MemberAccessReportService,
          useValue: {
            generateMemberAccessReportViewV2: () => {
              const members = [...Array(50).keys()].map(createMockMember);
              return Promise.resolve(members);
            },
            generateUserReportExportItemsV2: () => Promise.resolve([]),
          },
        },
      ],
    }),
  ],
};
