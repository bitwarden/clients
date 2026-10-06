import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Decorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { of } from "rxjs";

import { LogoutService } from "@bitwarden/auth/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { LockService } from "@bitwarden/unlock";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { PoliciesComponent } from "./policies.component";
import { RequireSsoPolicy } from "./policy-edit-definitions/require-sso.component";
import { SingleOrgPolicy } from "./policy-edit-definitions/single-org.component";
import { TwoFactorAuthenticationPolicy } from "./policy-edit-definitions/two-factor-authentication.component";
import { POLICY_EDIT_REGISTER } from "./policy-register-token";

const ORG_ID = "org-1" as OrganizationId;
const USER_ID = "user-1" as UserId;

function mockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_ID,
    name: "Acme Corp",
    ...overrides,
  } as unknown as Organization;
}

const mockAccountService = {
  activeAccount$: of({ id: USER_ID, email: "alice@example.com" }),
};

function makeOrganizationService(org: Organization) {
  return { organizations$: () => of([org]) };
}

const mockPolicyService = {
  policies$: () => of([]),
  policyAppliesToUser$: () => of(false),
};

const mockDialogService = {
  open: () => ({ closed: of(undefined) }),
  openDrawer: () =>
    Promise.resolve({
      closed: of(undefined),
      close: () => Promise.resolve({ closed: true }),
    }),
};

/** Pulled in transitively by ProductSwitcherService (providedIn: root), unrelated to the
 * policies page itself. */
const mockProviderService = {
  providers$: () => of([]),
};

const mockSyncService = {
  fullSync: () => Promise.resolve(true),
  getLastSync: () => Promise.resolve(new Date()),
};

const mockPlatformUtilsService = {
  isSelfHost: () => false,
};

const mockBillingAccountProfileStateService = {
  hasPremiumFromAnySource$: () => of(false),
};

const mockVaultTimeoutSettingsService = {
  availableVaultTimeoutActions$: () => of([]),
};

const mockLogoutService = {
  logout: () => Promise.resolve(undefined),
};

const mockLockService = {
  lock: () => Promise.resolve(),
};

const mockAvatarService = {
  avatarColor$: of("#FF0000"),
};

const policyDefinitions = [
  new SingleOrgPolicy(),
  new TwoFactorAuthenticationPolicy(),
  new RequireSsoPolicy(),
];

const routes: Routes = [
  {
    path: "organizations/:organizationId/policies",
    component: PoliciesComponent,
    providers: [{ provide: POLICY_EDIT_REGISTER, useValue: policyDefinitions }],
  },
];

/** Renders the story at `url`; hash routing keeps Storybook's own query string intact. */
const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

function makeMockPolicyResponse(overrides: Partial<PolicyResponse> = {}): PolicyResponse {
  return {
    id: "policy-1",
    organizationId: ORG_ID,
    data: null,
    canToggleState: true,
    revisionDate: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as unknown as PolicyResponse;
}

const mockOrgPolicyResponses: PolicyResponse[] = [
  makeMockPolicyResponse({ type: PolicyType.SingleOrg, enabled: true }),
  makeMockPolicyResponse({ type: PolicyType.TwoFactorAuthentication, enabled: true }),
  makeMockPolicyResponse({ type: PolicyType.RequireSso, enabled: false }),
];

function makePolicyApiService(policies: PolicyResponse[]) {
  return { getPolicies: () => Promise.resolve({ data: policies }) };
}

export default {
  title: "Admin Console/Organizations/Policies/Policies",
  component: PoliciesComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    componentWrapperDecorator((story) => `<div class="tw-p-6">${story}</div>`),
    moduleMetadata({
      imports: [RouterOutlet],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: OrganizationService, useValue: makeOrganizationService(mockOrganization()) },
        {
          provide: PolicyApiServiceAbstraction,
          useValue: makePolicyApiService(mockOrgPolicyResponses),
        },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        { provide: OrganizationService, useValue: makeOrganizationService(mockOrganization()) },
        { provide: ProviderService, useValue: mockProviderService },
        { provide: SyncService, useValue: mockSyncService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: PolicyService, useValue: mockPolicyService },
        {
          provide: BillingAccountProfileStateService,
          useValue: mockBillingAccountProfileStateService,
        },
        { provide: VaultTimeoutSettingsService, useValue: mockVaultTimeoutSettingsService },
        { provide: LogoutService, useValue: mockLogoutService },
        { provide: LockService, useValue: mockLockService },
        { provide: AvatarService, useValue: mockAvatarService },
      ],
    }),
  ],
} as Meta<PoliciesComponent>;

type Story = StoryObj<PoliciesComponent>;

/**
 * The policies list for an organization with a mix of enabled and disabled policies.
 */
export const Default: Story = {
  decorators: [atUrl(`/organizations/${ORG_ID}/policies`)],
};
