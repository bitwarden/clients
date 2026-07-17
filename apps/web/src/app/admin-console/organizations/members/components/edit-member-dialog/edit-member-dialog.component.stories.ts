import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";
import { GroupApiService, OrganizationUserAdminView, UserAdminService } from "../../../core";
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
    resetPasswordEnrolled: false,
    hasMasterPassword: true,
    claimedByOrganization: false,
    ...overrides,
  });
}

function defaultParams(overrides: Partial<EditMemberDialogParams> = {}): EditMemberDialogParams {
  return {
    kind: "Edit",
    organizationId: ORG_ID,
    organizationUserId: USER_ID,
    name: "Alice Smith",
    email: "alice@example.com",
    createdDate: new Date("2026-01-16T10:02:00Z"),
    usesKeyConnector: false,
    claimedByOrganization: false,
    isOnSecretsManagerStandalone: false,
    initialTab: MemberDialogTab.Role,
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

function makeConfigService(detailsTabEnabled: boolean) {
  return {
    getFeatureFlag: (flag: FeatureFlag) =>
      Promise.resolve(flag === FeatureFlag.PM28365_ChangeMemberEmail ? detailsTabEnabled : false),
  };
}

function makeOrganizationService(org: Organization) {
  return { organizations$: () => of([org]) };
}

type StoryArgs = { detailsTabEnabled: boolean };

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
      { provide: BillingConstraintService, useValue: mockBillingConstraintService },
      {
        provide: OrganizationMetadataServiceAbstraction,
        useValue: mockOrganizationMetadataService,
      },
      { provide: ValidationService, useValue: mockValidationService },
      { provide: LogService, useValue: mockLogService },
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
    detailsTabEnabled: {
      control: "boolean",
      description: "Toggle between the legacy Role tab and the new Details tab (PM-28365)",
      name: "Details tab (flag on)",
    },
  },
  args: {
    detailsTabEnabled: false,
  },
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

function makeRender(
  params: EditMemberDialogParams,
  org: Organization,
  userDetails?: OrganizationUserAdminView,
): Story["render"] {
  return ({ detailsTabEnabled }) => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            ...params,
            initialTab:
              params.initialTab !== MemberDialogTab.Groups &&
              params.initialTab !== MemberDialogTab.Collections
                ? detailsTabEnabled
                  ? MemberDialogTab.Details
                  : MemberDialogTab.Role
                : params.initialTab,
          },
        },
        { provide: OrganizationService, useValue: makeOrganizationService(org) },
        { provide: ConfigService, useValue: makeConfigService(detailsTabEnabled) },
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
    defaultParams({ claimedByOrganization: true }),
    mockOrganization({ productTierType: ProductTierType.Enterprise }),
    mockUserDetails({ claimedByOrganization: true }),
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

// ─── Flag ON (new Details tab design) ────────────────────────────────────────

/**
 * Details tab — Name, Email, Member role select, Created date.
 */
export const DetailsTab: Story = {
  args: { detailsTabEnabled: true },
  render: makeRender(defaultParams(), mockOrganization()),
};

/**
 * Details tab with Secrets Manager checkbox visible.
 */
export const DetailsTabWithSecretsManager: Story = {
  args: { detailsTabEnabled: true },
  render: makeRender(defaultParams(), mockOrganization({ useSecretsManager: true })),
};

/**
 * Details tab with custom permissions — Custom option selectable in role select.
 */
export const DetailsTabWithCustomPermissions: Story = {
  args: { detailsTabEnabled: true },
  render: makeRender(
    defaultParams(),
    mockOrganization({ useCustomPermissions: true, productTierType: ProductTierType.Enterprise }),
  ),
};

/**
 * Details tab, revoked member — "Revoked" badge in header; More actions shows Restore.
 */
export const DetailsTabRevokedMember: Story = {
  args: { detailsTabEnabled: true },
  render: makeRender(
    defaultParams(),
    mockOrganization(),
    mockUserDetails({ status: OrganizationUserStatusType.Revoked }),
  ),
};

/**
 * Details tab, member claimed by the organization — More actions shows Delete instead of Remove.
 */
export const DetailsTabClaimedByOrganization: Story = {
  args: { detailsTabEnabled: true },
  render: makeRender(
    defaultParams({ claimedByOrganization: true }),
    mockOrganization({ productTierType: ProductTierType.Enterprise }),
    mockUserDetails({ claimedByOrganization: true }),
  ),
};

/**
 * Details tab with groups — Groups tab visible alongside Details and Collections.
 */
export const DetailsTabWithGroups: Story = {
  args: { detailsTabEnabled: true },
  render: makeRender(
    defaultParams(),
    mockOrganization({ useGroups: true }),
    mockUserDetails({ groups: ["grp-1"] }),
  ),
};
