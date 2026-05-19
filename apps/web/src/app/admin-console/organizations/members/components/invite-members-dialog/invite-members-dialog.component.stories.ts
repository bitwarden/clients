import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { OrganizationInviteLinkService } from "@bitwarden/organization-invite-link";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";
import { GroupApiService, UserAdminService } from "../../../core";
import { OrganizationUserView } from "../../../core/views/organization-user.view";

import {
  InviteMembersDialogComponent,
  InviteMembersDialogParams,
} from "./invite-members-dialog.component";

function mockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1" as OrganizationId,
    name: "Acme Corp",
    useInviteLinks: true,
    useGroups: true,
    useSecretsManager: false,
    useCustomPermissions: false,
    seats: 10,
    allowAdminAccessToAllCollectionItems: true,
    productTierType: ProductTierType.Teams,
    permissions: new PermissionsApi(),
    enabled: true,
    canEditAnyCollection: false,
    ...overrides,
  } as unknown as Organization;
}

const dialogParams: InviteMembersDialogParams = {
  organizationId: "org-1",
  isOnSecretsManagerStandalone: false,
  occupiedSeatCount: 3,
  allOrganizationUsers: [] as OrganizationUserView[],
};

const mockAccountService = {
  activeAccount$: of({ id: "user-1" as UserId, email: "test@example.com" }),
};

const mockToastService = {
  showToast: () => {},
};

const mockPlatformUtilsService = {
  copyToClipboard: () => {},
};

const mockDialogRef = {
  close: () => {},
};

const mockDialogService = {
  open: () => ({ closed: of(undefined) }),
};

const mockGroups = [
  { id: "grp-1", name: "Admins" },
  { id: "grp-2", name: "Developers" },
  { id: "grp-3", name: "Designers" },
  { id: "grp-4", name: "Managers" },
];

const mockGroupApiService = {
  getAllDetails: () => Promise.resolve(mockGroups),
};

const mockUserAdminService = {
  invite: () => Promise.resolve(),
};

const mockCollections = [
  { id: "col-1", name: "Engineering", canEditUserAccess: () => true },
  { id: "col-2", name: "Marketing", canEditUserAccess: () => true },
  { id: "col-3", name: "Finance", canEditUserAccess: () => true },
  { id: "col-4", name: "HR", canEditUserAccess: () => true },
];

const mockCollectionAdminService = {
  collectionAdminViews$: () => of(mockCollections),
};

const mockInviteLinkServiceNoLink = {
  inviteLink$: () => of(undefined),
  reconstructUrl: () => of(undefined),
  createInviteLink: () => Promise.resolve(),
  updateInviteLink: () => Promise.resolve(),
  refreshInviteLink: () => Promise.resolve(),
};

export default {
  title: "Web/Organizations/Members/Invite Members Dialog",
  component: InviteMembersDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [InviteMembersDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: dialogParams },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useValue: mockDialogService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ToastService, useValue: mockToastService },
        { provide: GroupApiService, useValue: mockGroupApiService },
        { provide: UserAdminService, useValue: mockUserAdminService },
        { provide: CollectionAdminService, useValue: mockCollectionAdminService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<InviteMembersDialogComponent>;

type Story = StoryObj<InviteMembersDialogComponent>;

/**
 * Dialog with both tabs — email tab is active by default.
 * Organization has useInviteLinks: true.
 */
export const WithInviteLinks: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: OrganizationService,
          useValue: {
            organizations$: () => of([mockOrganization({ useInviteLinks: true })]),
          },
        },
        { provide: OrganizationInviteLinkService, useValue: mockInviteLinkServiceNoLink },
      ],
    }),
  ],
  render: () => ({
    template: `<app-invite-members-dialog></app-invite-members-dialog>`,
  }),
};

/**
 * Legacy email-only view — no tabs rendered because useInviteLinks is false.
 */
export const EmailOnlyNoTabs: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: OrganizationService,
          useValue: {
            organizations$: () => of([mockOrganization({ useInviteLinks: false })]),
          },
        },
        { provide: OrganizationInviteLinkService, useValue: mockInviteLinkServiceNoLink },
      ],
    }),
  ],
  render: () => ({
    template: `<app-invite-members-dialog></app-invite-members-dialog>`,
  }),
};
