import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkService,
} from "@bitwarden/organization-invite-link";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";
import { GroupApiService, UserAdminService } from "../../../core";
import { OrganizationUserView } from "../../../core/views/organization-user.view";
import { MemberActionsService } from "../../services/member-actions/member-actions.service";

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

const mockAccountService = {
  activeAccount$: of({ id: "user-1" as UserId, email: "test@example.com" }),
};

const mockToastService = {
  showToast: () => {},
};

const mockPlatformUtilsService = {
  copyToClipboard: () => {},
};

const mockEventCollectionService = {
  collect: () => Promise.resolve(),
  collectMany: () => Promise.resolve(),
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

const mockMemberActionsService = {
  invite: () => Promise.resolve({ success: true }),
  isProcessing: { set: () => {} },
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

const mockInviteLinkUrl =
  "https://vault.example.com/#/joinOrganization?organizationId=org-1&orgUserToken=abc123&orgName=Acme+Corp";

const mockInviteLink: OrganizationInviteLink = Object.assign(
  new OrganizationInviteLink({} as any),
  {
    id: "link-1",
    code: "abc123",
    organizationId: "org-1",
    allowedDomains: ["example.com", "acme.org"],
    invite: "enc-key",
    supportsConfirmation: true,
    creationDate: "2025-01-15T10:30:00Z",
  },
);

function makeMockInviteLinkService(initialLink: OrganizationInviteLink | undefined = undefined) {
  const inviteLink$ = new BehaviorSubject<OrganizationInviteLink | undefined>(initialLink);

  const upsertLink = (_userId: unknown, _orgId: unknown, domains: string[]) => {
    const current = inviteLink$.getValue();
    inviteLink$.next(
      Object.assign(new OrganizationInviteLink({} as any), {
        ...mockInviteLink,
        allowedDomains: domains,
        creationDate: current?.creationDate ?? new Date().toISOString(),
      }),
    );
    return Promise.resolve();
  };

  return {
    inviteLink$: () => inviteLink$.asObservable(),
    reconstructUrl: () => of(mockInviteLinkUrl),
    createInviteLink: upsertLink,
    updateInviteLink: upsertLink,
    refreshInviteLink: () => Promise.resolve(),
    delete: () => {
      inviteLink$.next(undefined);
      return Promise.resolve();
    },
  };
}

type StoryArgs = {
  /** Whether the org has the invite links feature enabled (shows the By Link tab). */
  useInviteLinks: boolean;
  /** Whether the org has groups enabled. */
  useGroups: boolean;
  /** Whether the org has Secrets Manager enabled (shows the SM checkbox). */
  useSecretsManager: boolean;
  /** Whether the org allows custom permissions (enables the Custom role option). */
  useCustomPermissions: boolean;
  /** Total seat count for the organization. */
  seats: number;
  /** Number of seats already occupied. */
  occupiedSeatCount: number;
};

export default {
  title: "Admin Console/Organizations/Members/Invite Members Dialog",
  component: InviteMembersDialogComponent,
  args: {
    useInviteLinks: true,
    useGroups: true,
    useSecretsManager: false,
    useCustomPermissions: false,
    seats: 10,
    occupiedSeatCount: 3,
  },
  argTypes: {
    useInviteLinks: {
      control: "boolean",
      description: "Enables the By Link tab (org feature flag).",
    },
    useGroups: {
      control: "boolean",
      description: "Enables group assignment in More Settings.",
    },
    useSecretsManager: {
      control: "boolean",
      description: "Shows the Secrets Manager checkbox.",
    },
    useCustomPermissions: {
      control: "boolean",
      description: "Enables the Custom role option in the role dropdown.",
    },
    seats: {
      control: { type: "number", min: 1, step: 1 },
      description: "Total seat count for the organization.",
    },
    occupiedSeatCount: {
      control: { type: "number", min: 0, step: 1 },
      description: "Seats already occupied; affects the remaining-seat hint.",
    },
  },
  decorators: [
    moduleMetadata({
      imports: [InviteMembersDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useValue: mockDialogService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ToastService, useValue: mockToastService },
        { provide: GroupApiService, useValue: mockGroupApiService },
        { provide: UserAdminService, useValue: mockUserAdminService },
        { provide: CollectionAdminService, useValue: mockCollectionAdminService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: MemberActionsService, useValue: mockMemberActionsService },
        { provide: EventCollectionService, useValue: mockEventCollectionService },
        {
          provide: OrgDomainApiServiceAbstraction,
          useValue: { getAllByOrgId: () => Promise.resolve([]) },
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

const makeRender =
  (initialLink: OrganizationInviteLink | undefined = undefined): Story["render"] =>
  (args) => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            organizationId: "org-1",
            isOnSecretsManagerStandalone: false,
            occupiedSeatCount: args.occupiedSeatCount,
            allOrganizationUsers: [] as OrganizationUserView[],
          } as InviteMembersDialogParams,
        },
        {
          provide: OrganizationService,
          useValue: {
            organizations$: () =>
              of([
                mockOrganization({
                  useInviteLinks: args.useInviteLinks,
                  useGroups: args.useGroups,
                  useSecretsManager: args.useSecretsManager,
                  useCustomPermissions: args.useCustomPermissions,
                  seats: args.seats,
                }),
              ]),
          },
        },
        {
          provide: OrganizationInviteLinkService,
          useValue: makeMockInviteLinkService(initialLink),
        },
      ],
    },
    template: `<app-invite-members-dialog></app-invite-members-dialog>`,
  });

/**
 * Dialog with both tabs — email tab is active by default, By Link tab has no link yet.
 */
export const WithInviteLinks: Story = {
  render: makeRender(),
};

/**
 * By Link tab already has a generated link — shows URL input with refresh/copy buttons.
 */
export const ByLinkTabWithExistingLink: Story = {
  render: makeRender(mockInviteLink),
};

/**
 * Legacy email-only view — no tabs rendered because useInviteLinks is false.
 */
export const EmailOnlyNoTabs: Story = {
  args: {
    useInviteLinks: false,
  },
  render: makeRender(),
};

/**
 * Organization with Secrets Manager enabled — shows the SM access checkbox.
 */
export const WithSecretsManager: Story = {
  args: {
    useSecretsManager: true,
  },
  render: makeRender(),
};
