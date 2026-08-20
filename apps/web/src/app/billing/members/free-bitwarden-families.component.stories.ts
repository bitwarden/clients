import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { LockService, LogoutService } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { OrganizationSponsorshipApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-sponsorship-api.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";
import { Vfo1TerminologyService } from "@bitwarden/vault";

import { PreloadedEnglishI18nModule } from "../../core/tests";
import { HeaderModule } from "../../layouts/header/header.module";

import { FreeBitwardenFamiliesComponent } from "./free-bitwarden-families.component";

const mockActivatedRoute = {
  data: of({ titleId: "" }),
  paramMap: of(convertToParamMap({})),
  snapshot: { params: {}, data: {} },
};

const mockRouter = { navigate: () => Promise.resolve(true), events: of(null), url: "/vault" };
const mockAccountService = {
  activeAccount$: of({ id: "user-1", email: "user@example.com", name: "Story User" }),
};
const mockStateProvider = { activeUserId$: of("user-1") };
const mockKeyService = { orgKeys$: () => of({}) };
const mockPlatformUtilsService = { isSelfHost: () => false };
const mockDialogService: Partial<DialogService> = {};
const mockToastService = { showToast: () => {} };
const mockLogService = { error: () => {} };
const mockApiService: Partial<ApiService> = {};
const mockEncryptService: Partial<EncryptService> = {};
const mockOrganizationSponsorshipApiService: Partial<OrganizationSponsorshipApiServiceAbstraction> =
  {};
const mockOrganizationService = { organizations$: () => of([]) };
const mockProviderService = { providers$: () => of([]) };
const mockPolicyService = { policiesByType$: () => of([]), policyAppliesToUser$: () => of(false) };
const mockSyncService = { getLastSync: () => Promise.resolve(new Date()) };
const mockBillingAccountProfileStateService = { hasPremiumFromAnySource$: () => of(false) };
const mockVaultTimeoutSettingsService = { availableVaultTimeoutActions$: () => of([]) };
const mockLogoutService = { logout: () => Promise.resolve() };
const mockLockService = { lock: () => Promise.resolve() };
const mockAvatarService = { avatarColor$: of("#175DDC") };
const mockConfigService = { getFeatureFlag$: () => of(false) } as unknown as ConfigService;

export default {
  title: "Billing/Members/Free Bitwarden Families",
  component: FreeBitwardenFamiliesComponent,
  decorators: [
    moduleMetadata({
      imports: [FreeBitwardenFamiliesComponent, HeaderModule],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ApiService, useValue: mockApiService },
        { provide: EncryptService, useValue: mockEncryptService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: LogService, useValue: mockLogService },
        { provide: ToastService, useValue: mockToastService },
        {
          provide: OrganizationSponsorshipApiServiceAbstraction,
          useValue: mockOrganizationSponsorshipApiService,
        },
        { provide: StateProvider, useValue: mockStateProvider },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: ProviderService, useValue: mockProviderService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: SyncService, useValue: mockSyncService },
        {
          provide: BillingAccountProfileStateService,
          useValue: mockBillingAccountProfileStateService,
        },
        { provide: VaultTimeoutSettingsService, useValue: mockVaultTimeoutSettingsService },
        { provide: LogoutService, useValue: mockLogoutService },
        { provide: LockService, useValue: mockLockService },
        { provide: AvatarService, useValue: mockAvatarService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<FreeBitwardenFamiliesComponent>;

/** Free Bitwarden Families sponsorship page — includes the "shared collections" info bullet. */
export const Default: Story = {};

/**
 * With the VFO1 terminology flag on — renders the updated "Sponsored Families Plan" copy
 * (intro paragraph and "The Bitwarden Families plan includes" heading), the info bullet
 * renders "Shared folders for family members" instead of "Shared collections for family
 * members", the table section heading renders "Non-member redemptions" instead of
 * "Sponsored families", and the empty state renders "No redemptions yet" / "No non-members
 * have redeemed the Sponsored Family Plan." instead of "No sponsored families" / "Sponsored
 * non-member families plans will display here".
 */
export const Vfo1Enabled: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: Vfo1TerminologyService,
          useValue: { enabled: () => true, iconClass: (icon: string) => icon },
        },
      ],
    }),
  ],
};
