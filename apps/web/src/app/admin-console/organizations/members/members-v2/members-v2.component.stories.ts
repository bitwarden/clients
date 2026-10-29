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

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { LogoutService } from "@bitwarden/auth/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
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

import { PreloadedEnglishI18nModule } from "../../../../core/tests";
import { OrganizationUserView } from "../../core/views/organization-user.view";
import { MemberActionsService } from "../services/member-actions/member-actions.service";
import { MemberDialogManagerService } from "../services/member-dialog-manager/member-dialog-manager.service";
import { OrganizationMembersService } from "../services/organization-members-service/organization-members.service";

import { MembersV2Component } from "./members-v2.component";

const ORG_ID = "org-1" as OrganizationId;
const USER_ID = "user-1" as UserId;

function mockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_ID,
    name: "Acme Corp",
    useGroups: true,
    useEvents: true,
    canManageUsers: true,
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
    type: OrganizationUserType.User,
    collectionNames: ["Marketing"],
    groupNames: ["Engineering"],
    resetPasswordEnrolled: false,
    claimedByOrganization: false,
    canSendInvite: false,
    canReinvite: false,
    canConfirm: false,
    canRestore: false,
    canRevoke: true,
    canRemove: true,
    ...overrides,
  } as unknown as OrganizationUserView;
}

/** A member in every status, and more than one page of them so the paginator shows. */
const mockMembers: OrganizationUserView[] = [
  mockUser({
    id: "user-1" as Guid,
    name: "Alice Smith",
    email: "alice@example.com",
    type: OrganizationUserType.Owner,
    groupNames: ["Engineering", "Leadership", "Security"],
    collectionNames: ["Engineering", "Finance"],
  }),
  mockUser({
    id: "user-2" as Guid,
    name: "Bob Jones",
    email: "bob@example.com",
    status: OrganizationUserStatusType.Invited,
  }),
  mockUser({
    id: "user-3" as Guid,
    name: undefined,
    email: "carol@example.com",
    status: OrganizationUserStatusType.Staged,
    groupNames: [],
    collectionNames: [],
  }),
  mockUser({
    id: "user-4" as Guid,
    name: "Dan Brown",
    email: "dan@example.com",
    status: OrganizationUserStatusType.Accepted,
    type: OrganizationUserType.Admin,
  }),
  mockUser({
    id: "user-5" as Guid,
    name: "Eve Adams",
    email: "eve@example.com",
    status: OrganizationUserStatusType.Revoked,
    groupNames: ["Sales", "Support"],
  }),
  ...Array.from({ length: 20 }, (_, i) =>
    mockUser({
      id: `user-${i + 6}` as Guid,
      name: `Member ${i + 6}`,
      email: `member${i + 6}@example.com`,
      type: i % 4 === 0 ? OrganizationUserType.Custom : OrganizationUserType.User,
      groupNames: i % 3 === 0 ? ["Support"] : ["Engineering", "Support"],
    }),
  ),
];

/**
 * One member per status plus a claimed member, so each Options menu can be checked against the
 * v1 conditions. Recover account shows for the members enrolled in account recovery.
 */
const rowActionMembers: OrganizationUserView[] = [
  mockUser({
    id: "staged" as Guid,
    name: "Sam Staged",
    email: "sam@example.com",
    status: OrganizationUserStatusType.Staged,
    canSendInvite: true,
  }),
  mockUser({
    id: "invited" as Guid,
    name: "Ivy Invited",
    email: "ivy@example.com",
    status: OrganizationUserStatusType.Invited,
    canReinvite: true,
  }),
  mockUser({
    id: "accepted" as Guid,
    name: "Alex Accepted",
    email: "alex@example.com",
    status: OrganizationUserStatusType.Accepted,
    canConfirm: true,
    resetPasswordEnrolled: true,
  }),
  mockUser({
    id: "confirmed" as Guid,
    name: "Casey Confirmed",
    email: "casey@example.com",
    status: OrganizationUserStatusType.Confirmed,
    resetPasswordEnrolled: true,
  }),
  mockUser({
    id: "revoked" as Guid,
    name: "Riley Revoked",
    email: "riley@example.com",
    status: OrganizationUserStatusType.Revoked,
    canRestore: true,
    canRevoke: false,
  }),
  mockUser({
    id: "claimed" as Guid,
    name: "Morgan Claimed",
    email: "morgan@acme.com",
    status: OrganizationUserStatusType.Confirmed,
    claimedByOrganization: true,
    canRemove: false,
  }),
];

function makeOrganizationService(org: Organization) {
  return { organizations$: () => of([org]) };
}

const mockAccountService = {
  activeAccount$: of({ id: USER_ID, email: "alice@example.com" }),
};

/** Pulled in transitively by the header's ProductSwitcherService, unrelated to the page itself. */
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

const mockConfigService = {
  getFeatureFlag$: () => of(false),
};

const mockPolicyApiService = {
  getPolicies: () => Promise.resolve({ data: [] }),
};

const mockOrganizationMetadataService = {
  getOrganizationMetadata$: () => of({}),
};

const mockDialogService = {
  open: () => ({ closed: of(undefined) }),
  openSimpleDialog: () => Promise.resolve(false),
};

const mockToastService = {
  showToast: () => {},
};

const mockLogService = {
  error: () => {},
  info: () => {},
  warning: () => {},
  debug: () => {},
};

const mockMemberActionsService = {
  isProcessing: () => false,
  removeUser: () => Promise.resolve({ success: true }),
  reinviteUser: () => of({ success: true }),
  sendInvite: () => of({ success: true }),
  confirmUser: () => Promise.resolve({ success: true }),
  revokeUser: () => Promise.resolve({ success: true }),
  restoreUser: () => Promise.resolve({ success: true }),
  deleteUser: () => Promise.resolve({ success: true }),
  getPublicKeyForConfirm: () => Promise.resolve(null),
  /** Stands in for the policy and permission checks: enrolled members can be recovered. */
  allowResetPassword: (user: OrganizationUserView) => user.resetPasswordEnrolled,
};

const mockMemberDialogManagerService = {
  openEditDialog: () => Promise.resolve(undefined),
  openAccountRecoveryDialog: () => Promise.resolve(undefined),
  openEventsDialog: () => {},
  openRemoveUserConfirmationDialog: () => Promise.resolve(false),
  openRevokeUserConfirmationDialog: () => Promise.resolve(false),
  openDeleteUserConfirmationDialog: () => Promise.resolve(false),
};

const mockBillingConstraintService = {
  checkSeatLimit: () => ({ canAddUsers: true }),
  seatLimitReached: () => Promise.resolve(false),
};

function makeOrganizationMembersService(members: OrganizationUserView[] | "loading") {
  return {
    loadUsers: () =>
      members === "loading" ? new Promise<never>(() => {}) : Promise.resolve(members),
  };
}

// Mirrors `members.routes.ts` (minus its guards and flag) so the page reads `organizationId`
// from a real route param, per the storybook-routing rule.
const routes: Routes = [
  {
    path: "organizations/:organizationId/members",
    component: MembersV2Component,
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
  title: "Admin Console/Organizations/Members/Members v2",
  component: MembersV2Component,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    atUrl(`/organizations/${ORG_ID}/members`),
    componentWrapperDecorator(
      (story) => `<bit-layout style="height: 800px" class="tw-p-6">${story}</bit-layout>`,
    ),
    moduleMetadata({
      imports: [MembersV2Component, RouterOutlet, LayoutComponent],
      providers: [
        UserNamePipe,
        { provide: PolicyApiServiceAbstraction, useValue: mockPolicyApiService },
        {
          provide: OrganizationMetadataServiceAbstraction,
          useValue: mockOrganizationMetadataService,
        },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: LogService, useValue: mockLogService },
        { provide: MemberActionsService, useValue: mockMemberActionsService },
        { provide: MemberDialogManagerService, useValue: mockMemberDialogManagerService },
        { provide: BillingConstraintService, useValue: mockBillingConstraintService },
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
        { provide: ConfigService, useValue: mockConfigService },
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
} as Meta<MembersV2Component>;

type Story = StoryObj<MembersV2Component>;

function makeRender(
  members: OrganizationUserView[] | "loading",
  organization: Organization = mockOrganization(),
): Story["render"] {
  return () => ({
    moduleMetadata: {
      providers: [
        { provide: OrganizationService, useValue: makeOrganizationService(organization) },
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
 * An organization that uses groups, with a member in every status and enough members to page.
 */
export const Default: Story = {
  render: makeRender(mockMembers),
};

/**
 * An organization that doesn't use groups shows Collections as the fourth column.
 */
export const Collections: Story = {
  render: makeRender(mockMembers, mockOrganization({ useGroups: false })),
};

/**
 * One member per status plus a claimed member. Open each Options menu to check it against the v1
 * conditions: Send invite (Staged), Resend invitation (Invited), Confirm (Accepted), Event logs
 * (Confirmed), Recover account (enrolled members), Restore (Revoked), and Delete instead of Remove
 * (claimed).
 */
export const RowActions: Story = {
  name: "Row actions",
  render: makeRender(rowActionMembers),
};

/**
 * An admin who can't manage users gets no checkbox column, no Options column and no clickable
 * cells.
 */
export const ReadOnly: Story = {
  name: "Read only",
  render: makeRender(mockMembers, mockOrganization({ canManageUsers: false })),
};

/**
 * Members haven't loaded yet.
 */
export const Loading: Story = {
  render: makeRender("loading"),
};

/**
 * An organization with no members.
 */
export const Empty: Story = {
  render: makeRender([]),
};
