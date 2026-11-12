import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { getByText, userEvent } from "storybook/test";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { CollectionAccessSelectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ProblemDetailsErrorResponse } from "@bitwarden/common/models/response/problem-details-error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { Vfo1TerminologyService } from "@bitwarden/vault";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";
import {
  GroupApiService,
  GroupView,
  OrganizationUserAdminView,
  UserAdminService,
} from "../../../core";
import { OrganizationUserView } from "../../../core/views/organization-user.view";
import { DeleteManagedMemberWarningService } from "../../services/delete-managed-member/delete-managed-member-warning.service";
import { MemberActionsService } from "../../services/member-actions/member-actions.service";
import { EditMemberDialogParams, MemberDialogTab } from "../member-dialog/member-dialog.types";

import { EditMemberDialogComponent } from "./edit-member-dialog.component";

const ORG_ID = "org-1" as OrganizationId;
const USER_ID = "user-1" as any;
const ACCOUNT_ID = "account-1" as UserId;

function mockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_ID,
    name: "Acme Corp",
    useGroups: false,
    useSecretsManager: false,
    useCustomPermissions: false,
    canEditAnyCollection: true,
    allowAdminAccessToAllCollectionItems: true,
    permissions: new PermissionsApi(),
    productTierType: ProductTierType.Teams,
    ...overrides,
  } as unknown as Organization;
}

function mockUserDetails(
  overrides: Partial<OrganizationUserAdminView> = {},
): OrganizationUserAdminView {
  return new OrganizationUserAdminView({
    id: USER_ID,
    userId: "other-account-id" as any,
    organizationId: ORG_ID,
    collections: [],
    groups: [],
    type: OrganizationUserType.User,
    status: OrganizationUserStatusType.Confirmed,
    externalId: "",
    ssoExternalId: "",
    permissions: new PermissionsApi(),
    accessSecretsManager: false,
    accessPam: false,
    resetPasswordEnrolled: false,
    hasMasterPassword: true,
    claimedByOrganization: false,
    ...overrides,
  });
}

function listMember(
  overrides: Partial<
    Pick<OrganizationUserView, "claimedByOrganization" | "hasMasterPassword">
  > = {},
): OrganizationUserView {
  const member = new OrganizationUserView({
    id: USER_ID,
    userId: "other-account-id" as any,
    email: "alice@example.com",
    type: OrganizationUserType.User,
    revocationReason: undefined as any,
    status: OrganizationUserStatusType.Confirmed,
    permissions: new PermissionsApi(),
    avatarColor: "",
    name: "Alice Smith",
    claimedByOrganization: overrides.claimedByOrganization ?? false,
  });
  member.hasMasterPassword = overrides.hasMasterPassword ?? true;
  return member;
}

function defaultParams(
  overrides: Partial<EditMemberDialogParams> = {},
  memberOverrides: Parameters<typeof listMember>[0] = {},
): EditMemberDialogParams {
  return {
    organizationId: ORG_ID,
    member: listMember(memberOverrides),
    createdDate: new Date("2026-01-16T10:02:00Z"),
    isOnSecretsManagerStandalone: false,
    initialTab: MemberDialogTab.Details,
    ...overrides,
  };
}

const mockAccountService = {
  activeAccount$: of({ id: ACCOUNT_ID, email: "alice@example.com" }),
};

const mockDialogRef = {
  close: () => {},
};

const mockDialogService = {
  openSimpleDialog: () => Promise.resolve(true),
};

const mockToastService = {
  showToast: () => {},
};

const mockGroupApiService = {
  getAllDetails: () => Promise.resolve([]),
  getAll: () =>
    Promise.resolve([
      new GroupView({ id: "grp-1", organizationId: ORG_ID, name: "Engineering" }),
      new GroupView({ id: "grp-2", organizationId: ORG_ID, name: "Finance" }),
    ]),
};

const mockUserAdminService = {
  get: () => Promise.resolve(mockUserDetails()),
  saveV2: () => Promise.resolve(),
};

const mockCollectionAdminService = {
  collectionAdminViews$: () =>
    of([
      { id: "col-1", name: "Engineering", canEditUserAccess: () => true, users: [], groups: [] },
      { id: "col-2", name: "Marketing", canEditUserAccess: () => true, users: [], groups: [] },
      { id: "col-3", name: "Finance", canEditUserAccess: () => true, users: [], groups: [] },
    ]),
};

const mockMemberActionsService = {
  revokeUser: () => Promise.resolve({ success: true }),
  restoreUser: () => Promise.resolve({ success: true }),
  removeUser: () => Promise.resolve({ success: true }),
  deleteUser: () => Promise.resolve({ success: true }),
};

const mockDeleteManagedMemberWarningService = {
  warningAcknowledged: () => of(false),
  showWarning: () => Promise.resolve(true),
  acknowledgeWarning: () => Promise.resolve(),
};

const mockBillingConstraintService = {
  checkSeatLimit: () => ({ canAddUsers: true }),
  seatLimitReached: () => Promise.resolve(false),
};

const mockOrganizationMetadataService = {
  getOrganizationMetadata$: () => of({ organizationOccupiedSeats: 0 } as any),
  refreshMetadataCache: () => {},
};

const mockValidationService: Partial<ValidationService> = {
  showError: () => [],
};

const mockLogService: Partial<LogService> = {
  error: () => {},
};

const mockPlatformUtilsService: Partial<PlatformUtilsService> = {
  copyToClipboard: () => {},
};

function makeConfigService() {
  return {
    getFeatureFlag: () => Promise.resolve(false),
  };
}

function makeOrganizationService(org: Organization) {
  return { organizations$: () => of([org]) };
}

type StoryArgs = {
  /** Toggles the vfo1-foundation flag - "Collection" copy becomes "Shared folder" copy. */
  vfo1FoundationEnabled: boolean;
};

const sharedDecorators = [
  moduleMetadata({
    imports: [EditMemberDialogComponent],
    providers: [
      { provide: DialogRef, useValue: mockDialogRef },
      { provide: DialogService, useValue: mockDialogService },
      { provide: AccountService, useValue: mockAccountService },
      { provide: ToastService, useValue: mockToastService },
      { provide: GroupApiService, useValue: mockGroupApiService },
      { provide: UserAdminService, useValue: mockUserAdminService },
      { provide: CollectionAdminService, useValue: mockCollectionAdminService },
      { provide: MemberActionsService, useValue: mockMemberActionsService },
      {
        provide: DeleteManagedMemberWarningService,
        useValue: mockDeleteManagedMemberWarningService,
      },
      {
        provide: OrganizationMetadataServiceAbstraction,
        useValue: mockOrganizationMetadataService,
      },
      {
        provide: BillingConstraintService,
        useValue: mockBillingConstraintService,
      },
      { provide: ValidationService, useValue: mockValidationService },
      { provide: LogService, useValue: mockLogService },
      { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
    ],
  }),
  applicationConfig({
    providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
  }),
];

export default {
  title: "Admin Console/Organizations/Members/Edit Member Dialog",
  component: EditMemberDialogComponent,
  decorators: sharedDecorators,
  argTypes: {
    vfo1FoundationEnabled: {
      control: "boolean",
      description: 'Toggle the vfo1-foundation flag ("Collection" → "Shared folder" copy).',
      name: "Shared folder terminology (flag on)",
    },
  },
  args: {
    vfo1FoundationEnabled: false,
  },
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

function makeRender(
  params: EditMemberDialogParams,
  org: Organization,
  userDetails?: OrganizationUserAdminView,
): Story["render"] {
  return ({ vfo1FoundationEnabled }) => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            ...params,
            initialTab:
              params.initialTab !== MemberDialogTab.Groups &&
              params.initialTab !== MemberDialogTab.Collections
                ? MemberDialogTab.Details
                : params.initialTab,
          },
        },
        { provide: OrganizationService, useValue: makeOrganizationService(org) },
        { provide: ConfigService, useValue: makeConfigService() },
        {
          provide: Vfo1TerminologyService,
          useValue: {
            enabled: () => vfo1FoundationEnabled,
            iconClass: (icon: string) => icon,
          },
        },
        ...(userDetails
          ? [
              {
                provide: UserAdminService,
                useValue: { ...mockUserAdminService, get: () => Promise.resolve(userDetails) },
              },
            ]
          : []),
      ],
    },
    template: `<app-edit-member-dialog></app-edit-member-dialog>`,
  });
}

/**
 * Default confirmed member.
 */
export const Default: Story = {
  render: makeRender(defaultParams(), mockOrganization()),
};

/**
 * Organization with groups enabled — Groups tab visible.
 */
export const WithGroups: Story = {
  render: makeRender(
    defaultParams(),
    mockOrganization({ useGroups: true }),
    mockUserDetails({ groups: ["grp-1"] }),
  ),
};

/**
 * Organization with Secrets Manager.
 */
export const WithSecretsManager: Story = {
  render: makeRender(defaultParams(), mockOrganization({ useSecretsManager: true })),
};

/**
 * Enterprise org with custom permissions enabled.
 */
export const WithCustomPermissions: Story = {
  render: makeRender(
    defaultParams(),
    mockOrganization({ useCustomPermissions: true, productTierType: ProductTierType.Enterprise }),
  ),
};

/**
 * Revoked member — "Revoked" badge in the header.
 */
export const RevokedMember: Story = {
  render: makeRender(
    defaultParams(),
    mockOrganization(),
    mockUserDetails({ status: OrganizationUserStatusType.Revoked }),
  ),
};

/**
 * Member claimed by the organization — footer shows Delete instead of Remove.
 */
export const ClaimedByOrganization: Story = {
  render: makeRender(
    defaultParams({}, { claimedByOrganization: true }),
    mockOrganization({ productTierType: ProductTierType.Enterprise }),
    mockUserDetails({ claimedByOrganization: true }),
  ),
};

/**
 * Member provisioned through Directory Connector and SSO — the read-only External ID and
 * SSO External ID fields are shown on the Details tab.
 */
export const WithExternalIds: Story = {
  render: makeRender(
    defaultParams(),
    mockOrganization(),
    mockUserDetails({
      externalId: "1308a41a-5c5b-46d3-9573-abad9b0608dc",
      ssoExternalId: "alice@example.com",
    }),
  ),
};

/**
 * Opens directly on the Collections tab.
 */
export const CollectionsTab: Story = {
  render: makeRender(
    defaultParams({ initialTab: MemberDialogTab.Collections }),
    mockOrganization(),
  ),
};

// ─── Flag ON (vfo1-foundation: "Collection" → "Shared folder" terminology) ───

/**
 * Collections tab with the vfo1-foundation flag on — renders "Shared folder" terminology,
 * including the role hint text and the tab/column labels.
 */
export const CollectionsTabSharedFolderTerminology: Story = {
  args: { vfo1FoundationEnabled: true },
  render: makeRender(
    defaultParams({ initialTab: MemberDialogTab.Collections }),
    mockOrganization(),
  ),
};

/**
 * Custom permissions with the vfo1-foundation flag on — the nested-checkbox labels
 * ("Manage all shared folders", "Create new shared folders", etc.) use the new terminology
 * while the underlying form-control names are unchanged.
 */
export const WithCustomPermissionsSharedFolderTerminology: Story = {
  args: { vfo1FoundationEnabled: true },
  render: makeRender(
    defaultParams(),
    mockOrganization({ useCustomPermissions: true, productTierType: ProductTierType.Enterprise }),
  ),
};

/**
 * Details tab with email editing enabled — member is claimed by the org and has no master
 * password, so the email field is editable.
 */
export const DetailsTabEditEmail: Story = {
  render: makeRender(
    defaultParams({}, { claimedByOrganization: true, hasMasterPassword: false }),
    mockOrganization({ productTierType: ProductTierType.Enterprise }),
    mockUserDetails({ claimedByOrganization: true, hasMasterPassword: false }),
  ),
};

/**
 * Details tab — server rejects the email change with a domain-not-claimed error, showing the
 * inline field error after submit.
 */
export const DetailsTabEditEmailError: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: defaultParams(
            { initialTab: MemberDialogTab.Details },
            { claimedByOrganization: true, hasMasterPassword: false },
          ),
        },
        {
          provide: OrganizationService,
          useValue: makeOrganizationService(
            mockOrganization({ productTierType: ProductTierType.Enterprise }),
          ),
        },
        { provide: ConfigService, useValue: makeConfigService() },
        {
          provide: UserAdminService,
          useValue: {
            ...mockUserAdminService,
            get: () =>
              Promise.resolve(
                mockUserDetails({ claimedByOrganization: true, hasMasterPassword: false }),
              ),
            saveV2: () =>
              Promise.reject(
                new ProblemDetailsErrorResponse(
                  {
                    errors: {
                      email: [
                        { type: "new_email_domain_not_claimed", detail: "Domain not claimed" },
                      ],
                    },
                  },
                  400,
                ),
              ),
          },
        },
      ],
    },
    template: `<app-edit-member-dialog></app-edit-member-dialog>`,
  }),
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const submitButton = getByText(canvasElement, "Save");
    await userEvent.click(submitButton);
  },
};

// ─── Read only (an admin who can't manage users, like one who can only recover accounts) ───

function access(id: string, readOnly = false): CollectionAccessSelectionView {
  return new CollectionAccessSelectionView({ id, readOnly, hidePasswords: false, manage: false });
}

/**
 * Alice is a custom member in the Engineering group, assigned Marketing directly and Engineering
 * through the group.
 */
function mockMember(): OrganizationUserView {
  const member = new OrganizationUserView({
    id: USER_ID,
    userId: "other-account-id" as any,
    email: "alice@example.com",
    type: OrganizationUserType.Custom,
    revocationReason: undefined as any,
    status: OrganizationUserStatusType.Confirmed,
    permissions: Object.assign(new PermissionsApi(), {
      accessReports: true,
      manageResetPassword: true,
    }),
    avatarColor: "",
    name: "Alice Smith",
  });
  member.groups = ["grp-1"];
  member.hasMasterPassword = true;
  member.accessSecretsManager = true;
  return member;
}

const readOnlyCollectionAdminService = {
  collectionAdminViews$: () =>
    of([
      {
        id: "col-1",
        name: "Engineering",
        canEditUserAccess: () => false,
        users: [],
        groups: [access("grp-1")],
      },
      {
        id: "col-2",
        name: "Marketing",
        canEditUserAccess: () => false,
        users: [access(USER_ID, true)],
        groups: [],
      },
      {
        id: "col-3",
        name: "Finance",
        canEditUserAccess: () => false,
        users: [],
        groups: [access("grp-2")],
      },
    ]),
};

function makeReadOnlyRender(initialTab: MemberDialogTab): Story["render"] {
  const render = makeRender(
    defaultParams({ readonly: true, member: mockMember(), initialTab }),
    mockOrganization({
      useGroups: true,
      useSecretsManager: true,
      useCustomPermissions: true,
      productTierType: ProductTierType.Enterprise,
      permissions: Object.assign(new PermissionsApi(), { manageResetPassword: true }),
      canEditAnyCollection: false,
      allowAdminAccessToAllCollectionItems: false,
    }),
  );
  return (args, context) => {
    const story = render!(args, context);
    return {
      ...story,
      moduleMetadata: {
        ...story.moduleMetadata,
        providers: [
          ...(story.moduleMetadata?.providers ?? []),
          { provide: CollectionAdminService, useValue: readOnlyCollectionAdminService },
          {
            provide: UserAdminService,
            useValue: {
              get: () => Promise.reject(new Error("Read only reads the members list row")),
            },
          },
        ],
      },
    };
  };
}

/**
 * Details tab, read only: the role, custom permissions and Secrets Manager access are disabled,
 * and the footer has only Close — no Save, Remove or Revoke.
 */
export const ReadOnlyDetailsTab: Story = {
  name: "Read only: Details tab",
  render: makeReadOnlyRender(MemberDialogTab.Details),
};

/**
 * Groups tab, read only: the member's groups are listed without the group picker or remove
 * buttons.
 */
export const ReadOnlyGroupsTab: Story = {
  name: "Read only: Groups tab",
  render: makeReadOnlyRender(MemberDialogTab.Groups),
};

/**
 * Collections tab, read only: Marketing, assigned directly, and Engineering, through the
 * Engineering group, are listed with their permissions and no collection picker or remove
 * buttons. Finance, assigned only to a group the member isn't in, isn't listed.
 */
export const ReadOnlyCollectionsTab: Story = {
  name: "Read only: Collections tab",
  render: makeReadOnlyRender(MemberDialogTab.Collections),
};
