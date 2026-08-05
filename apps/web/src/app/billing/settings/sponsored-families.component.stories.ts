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
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";
import { Vfo1TerminologyService } from "@bitwarden/vault";

import { PreloadedEnglishI18nModule } from "../../core/tests";
import { HeaderModule } from "../../layouts/header/header.module";
import { FreeFamiliesPolicyService } from "../services/free-families-policy.service";

import { SponsoredFamiliesComponent } from "./sponsored-families.component";

const mockActivatedRoute = {
  data: of({ titleId: "" }),
  paramMap: of(convertToParamMap({})),
  snapshot: { params: {}, data: {} },
};

const mockRouter = { navigate: () => Promise.resolve(true), events: of(null), url: "/vault" };
const mockAccountService = {
  activeAccount$: of({ id: "user-1", email: "user@example.com", name: "Story User" }),
};

const mockOrganizationService = { organizations$: () => of([]) };
const mockProviderService = { providers$: () => of([]) };
const mockPolicyService = { policiesByType$: () => of([]), policyAppliesToUser$: () => of(false) };
const mockPlatformUtilsService = { isSelfHost: () => false };
const mockSyncService: Partial<SyncService> = {
  fullSync: () => Promise.resolve(true),
  getLastSync: () => Promise.resolve(new Date()),
} as unknown as Partial<SyncService>;
const mockToastService = { showToast: () => {} };
const mockApiService: Partial<ApiService> = {};
const mockFreeFamiliesPolicyService = { showFreeFamilies$: of(true) };
const mockBillingAccountProfileStateService = { hasPremiumFromAnySource$: () => of(false) };
const mockVaultTimeoutSettingsService = { availableVaultTimeoutActions$: () => of([]) };
const mockLogoutService = { logout: () => Promise.resolve() };
const mockLockService = { lock: () => Promise.resolve() };
const mockAvatarService = { avatarColor$: of("#175DDC") };
const mockConfigService = { getFeatureFlag$: () => of(false) } as unknown as ConfigService;

export default {
  title: "Billing/Settings/Sponsored Families",
  component: SponsoredFamiliesComponent,
  decorators: [
    moduleMetadata({
      imports: [SponsoredFamiliesComponent, HeaderModule],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: ApiService, useValue: mockApiService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: SyncService, useValue: mockSyncService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ToastService, useValue: mockToastService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: FreeFamiliesPolicyService, useValue: mockFreeFamiliesPolicyService },
        { provide: ProviderService, useValue: mockProviderService },
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

type Story = StoryObj<SponsoredFamiliesComponent>;

/** Sponsored families settings page — includes the "shared collections" info bullet. */
export const Default: Story = {};

/**
 * With the VFO1 terminology flag on — renders the updated "Sponsored Families Plan" copy
 * (intro paragraph and "The Bitwarden Families plan includes" heading) and the info bullet
 * renders "Shared folders for family members" instead of "Shared collections for family
 * members".
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
