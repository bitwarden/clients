import "../../../billing/organizations/change-plan-dialog.component";

import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Decorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { EMPTY, of } from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { LogoutService } from "@bitwarden/auth/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { Guid, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  DialogService,
  LayoutComponent,
  StorybookGlobalStateProvider,
  ToastService,
} from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";
import { LockService } from "@bitwarden/unlock";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import { PreloadedEnglishI18nModule } from "../../../core/tests";
import { OrganizationUserView } from "../core/views/organization-user.view";

import { MembersComponent } from "./members.component";
import { MembersModule } from "./members.module";
import { DeleteManagedMemberWarningService } from "./services/delete-managed-member/delete-managed-member-warning.service";
import { MemberActionsService } from "./services/member-actions/member-actions.service";
import { MemberDialogManagerService } from "./services/member-dialog-manager/member-dialog-manager.service";
import { MemberExportService } from "./services/member-export/member-export.service";
import { OrganizationMembersService } from "./services/organization-members-service/organization-members.service";

const ORG_ID = "org-1" as OrganizationId;
const USER_ID = "user-1" as UserId;

@Component({
  selector: "app-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
})
class StubHeaderComponent {}

function mockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_ID,
    name: "Acme Corp",
    useGroups: true,
    useSecretsManager: false,
    usePam: false,
    canManageUsers: true,
    useResetPassword: false,
    isProviderUser: false,
    ...overrides,
  } as unknown as Organization;
}

function mockUser(overrides: Partial<OrganizationUserView> = {}): OrganizationUserView {
  return {
    id: "user-1",
    userId: "user-1",
    name: "Alice Smith",
    email: "alice@example.com",
    status: OrganizationUserStatusType.Confirmed,
    type: 2,
    twoFactorEnabled: false,
    resetPasswordEnrolled: false,
    claimedByOrganization: false,
    collectionNames: [],
    groupNames: ["Engineering"],
    canConfirm: false,
    canReinvite: false,
    canRestore: false,
    canRevoke: true,
    canRemove: true,
    canManageMember: true,
    ...overrides,
  } as unknown as OrganizationUserView;
}

const mockMembers: OrganizationUserView[] = [
  mockUser({ id: "user-1" as Guid, name: "Alice Smith", email: "alice@example.com" }),
  mockUser({
    id: "user-2" as Guid,
    name: "Bob Jones",
    email: "bob@example.com",
    status: OrganizationUserStatusType.Invited,
    canReinvite: true,
    canRevoke: false,
    canRemove: false,
  }),
];

function makeOrganizationService(org: Organization) {
  return { organizations$: () => of([org]) };
}

const mockAccountService = {
  activeAccount$: of({ id: USER_ID, email: "alice@example.com" }),
};

/** Pulled in transitively by ProductSwitcherService (providedIn: root), unrelated to the
 * members page itself. */
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

const mockVaultTimeoutSettingsService = {
  availableVaultTimeoutActions$: () => of([]),
};

const mockLogoutService = {
  logout: () => Promise.resolve(undefined),
};

const mockLockService = {
  lock: () => Promise.resolve(),
};

const mockBillingAccountProfileStateService = {
  hasPremiumFromAnySource$: () => of(false),
};

const mockPolicyService = {
  policies$: () => of([]),
  policyAppliesToUser$: () => of(false),
};

const mockAvatarService = {
  avatarColor$: of("#FF0000"),
};

const mockPolicyApiService = {
  getPolicies: () => Promise.resolve({ data: [] }),
};

const mockOrganizationMetadataService = {
  getOrganizationMetadata$: () => of({}),
  refreshMetadataCache: () => {},
};

const mockEnvironmentService = {
  environment$: of({ isCloud: () => false }),
};

const mockConfigService = {
  getFeatureFlag$: () => of(false),
};

const mockDialogService = {
  open: () => ({ closed: of(undefined) }),
  openSimpleDialog: () => Promise.resolve(false),
};

const mockToastService = {
  showToast: () => {},
};

// `showInactiveSubscriptionDialog$` / `showSubscribeBeforeFreeTrialEndsDialog$` are invoked by
// MembersComponent itself and merged into a subscription that never needs to emit for a render.
// `getFreeTrialWarning$` is invoked by <app-organization-free-trial-warning>, which
// MembersComponent renders.
const mockOrganizationWarningsService = {
  showInactiveSubscriptionDialog$: () => EMPTY,
  showSubscribeBeforeFreeTrialEndsDialog$: () => EMPTY,
  getFreeTrialWarning$: () => of(null),
};

const mockMemberActionsService = {
  isProcessing: () => false,
  removeUser: () => Promise.resolve({ success: true }),
  reinviteUser: () => Promise.resolve({ success: true }),
  confirmUser: () => Promise.resolve({ success: true }),
  revokeUser: () => Promise.resolve({ success: true }),
  restoreUser: () => Promise.resolve({ success: true }),
  deleteUser: () => Promise.resolve({ success: true }),
  bulkReinvite: () => Promise.resolve({ successful: [], failed: [] }),
  allowResetPassword: () => false,
  getPublicKeyForConfirm: () => Promise.resolve(null),
};

const mockMemberDialogManagerService = {
  openInviteDialog: () => Promise.resolve(undefined),
  openEditDialog: () => Promise.resolve(undefined),
  openAccountRecoveryDialog: () => Promise.resolve(undefined),
  openBulkConfirmDialog: () => Promise.resolve(undefined),
  openBulkRemoveDialog: () => Promise.resolve(undefined),
  openBulkDeleteDialog: () => Promise.resolve(undefined),
  openBulkRestoreRevokeDialog: () => Promise.resolve(undefined),
  openBulkEnableSecretsManagerDialog: () => Promise.resolve(undefined),
  openBulkActivatePrivilegedControlsDialog: () => Promise.resolve(undefined),
  openBulkStatusDialog: () => Promise.resolve(undefined),
  openEventsDialog: () => {},
  openRemoveUserConfirmationDialog: () => Promise.resolve(false),
  openRevokeUserConfirmationDialog: () => Promise.resolve(false),
  openDeleteUserConfirmationDialog: () => Promise.resolve(false),
};

const mockDeleteManagedMemberWarningService = {
  warningAcknowledged: () => of(false),
  showWarning: () => Promise.resolve(true),
  acknowledgeWarning: () => Promise.resolve(),
};

const mockBillingConstraintService = {
  checkSeatLimit: () => ({ canAddUsers: true }),
  seatLimitReached: () => Promise.resolve(false),
  navigateToPaymentMethod: () => Promise.resolve(),
};

const mockValidationService = {
  showError: (): string[] => [],
};

const mockLogService = {
  error: () => {},
  info: () => {},
  warning: () => {},
  debug: () => {},
};

const mockMemberExportService = {
  getMemberExport: () => ({ success: true }),
};

function makeOrganizationMembersService(members: OrganizationUserView[]) {
  return { loadUsers: () => Promise.resolve(members) };
}

// Mirrors `members-routing.module.ts` (minus its guards) so the page reads `organizationId`
// from a real route param, per the storybook-routing rule.
const routes: Routes = [
  {
    path: "organizations/:organizationId/members",
    component: MembersComponent,
  },
];

/** Renders the story at `url`; hash routing keeps Storybook's own query string intact. */
const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

export default {
  title: "Admin Console/Organizations/Members/Members",
  component: MembersComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    componentWrapperDecorator(
      (story) => `<bit-layout style="height: 800px" class="tw-p-6">${story}</bit-layout>`,
    ),
    moduleMetadata({
      imports: [MembersModule, StubHeaderComponent, RouterOutlet, LayoutComponent],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: PolicyApiServiceAbstraction, useValue: mockPolicyApiService },
        {
          provide: OrganizationMetadataServiceAbstraction,
          useValue: mockOrganizationMetadataService,
        },
        { provide: EnvironmentService, useValue: mockEnvironmentService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: OrganizationWarningsService, useValue: mockOrganizationWarningsService },
        { provide: MemberActionsService, useValue: mockMemberActionsService },
        { provide: MemberDialogManagerService, useValue: mockMemberDialogManagerService },
        {
          provide: DeleteManagedMemberWarningService,
          useValue: mockDeleteManagedMemberWarningService,
        },
        { provide: BillingConstraintService, useValue: mockBillingConstraintService },
        { provide: ValidationService, useValue: mockValidationService },
        { provide: LogService, useValue: mockLogService },
        { provide: MemberExportService, useValue: mockMemberExportService },
        UserNamePipe,
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        { provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider },
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
} as Meta<MembersComponent>;

type Story = StoryObj<MembersComponent>;

function makeRender(members: OrganizationUserView[]): Story["render"] {
  return () => ({
    moduleMetadata: {
      providers: [
        { provide: OrganizationService, useValue: makeOrganizationService(mockOrganization()) },
        {
          provide: OrganizationMembersService,
          useValue: makeOrganizationMembersService(members),
        },
      ],
    },
    template: `<router-outlet></router-outlet>`,
  });
}

/**
 * The members list with a couple of confirmed/invited members.
 */
export const Default: Story = {
  decorators: [atUrl(`/organizations/${ORG_ID}/members`)],
  render: makeRender(mockMembers),
};

/**
 * No members have loaded yet.
 */
export const Empty: Story = {
  decorators: [atUrl(`/organizations/${ORG_ID}/members`)],
  render: makeRender([]),
};
