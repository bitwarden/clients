import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  CopyClickDirective,
  DIALOG_DATA,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { Vfo1I18nPipe } from "@bitwarden/vault";

import { PreloadedEnglishI18nModule } from "../../../../core/tests";
import { InternalGroupApiService } from "../../core";
import { GroupDetailsView } from "../../core/views/group-details.view";
import { SharedOrganizationModule } from "../../shared";

import { GroupAddDialogComponent } from "./group-add-dialog.component";
import {
  GroupAddDialogParams,
  GroupAddEditTabType,
  GroupEditDialogParams,
} from "./group-add-edit.types";
import { GroupEditDialogComponent } from "./group-edit-dialog.component";

const ORG_ID = "org-1" as OrganizationId;
const GROUP_ID = "group-1";
const USER_ID = "user-1" as UserId;

function mockOrganization(overrides: Partial<Organization> = {}): Organization {
  return Object.assign(new Organization(), {
    id: ORG_ID,
    name: "Acme Corp",
    useGroups: true,
    allowAdminAccessToAllCollectionItems: true,
    type: OrganizationUserType.Admin,
    isProviderUser: false,
    permissions: new PermissionsApi(),
    productTierType: ProductTierType.Teams,
    ...overrides,
  });
}

const mockCollections: CollectionAdminView[] = [
  Object.assign(
    new CollectionAdminView({
      id: "col-1" as CollectionId,
      organizationId: ORG_ID,
      name: "Engineering",
    }),
    { groups: [], users: [], manage: true },
  ),
  Object.assign(
    new CollectionAdminView({
      id: "col-2" as CollectionId,
      organizationId: ORG_ID,
      name: "Design",
    }),
    { groups: [], users: [], manage: true },
  ),
];

const mockMembers = {
  data: [
    {
      id: "u-1",
      userId: USER_ID,
      name: "Alice Smith",
      email: "alice@example.com",
      type: 0,
      status: 2,
    },
    {
      id: "u-2",
      userId: "user-2" as UserId,
      name: "Bob Jones",
      email: "bob@example.com",
      type: 0,
      status: 2,
    },
  ],
};

const mockGroupDetails = new GroupDetailsView({
  id: GROUP_ID,
  organizationId: ORG_ID,
  name: "Engineering Team",
  collections: [{ id: "col-1", readOnly: false, hidePasswords: false, manage: true }],
});

const mockGroupDetailsWithExternalId = new GroupDetailsView({
  id: GROUP_ID,
  organizationId: ORG_ID,
  name: "Engineering Team",
  externalId: "1308a41a-5c5b-46d3-9573-abad9b0608dc",
  collections: [{ id: "col-1", readOnly: false, hidePasswords: false, manage: true }],
});

const mockDialogRef = { close: () => {} };
const mockDialogService = { openSimpleDialog: () => Promise.resolve(false) };
const mockToastService = { showToast: () => {} };
const mockLogService = { error: () => {} };
const mockPlatformUtilsService = { isSelfHost: () => false, copyToClipboard: () => {} };

const mockApiService = {
  getGroupUsers: () => Promise.resolve(["u-1"]),
};

const mockOrganizationUserApiService = {
  getAllMiniUserDetails: () => Promise.resolve(mockMembers),
};

const mockCollectionAdminService = {
  collectionAdminViews$: () => of(mockCollections),
};

const mockAccountService = {
  activeAccount$: of({ id: USER_ID, email: "alice@example.com" }),
};

function makeOrganizationService(org: Organization) {
  return { organizations$: () => of([org]) };
}

function makeGroupService(group?: GroupDetailsView) {
  return {
    get: () => Promise.resolve(group),
    save: () => Promise.resolve({}),
    delete: () => Promise.resolve(),
  };
}

const sharedProviders = [
  { provide: DialogRef, useValue: mockDialogRef },
  { provide: DialogService, useValue: mockDialogService },
  { provide: ToastService, useValue: mockToastService },
  { provide: LogService, useValue: mockLogService },
  { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
  { provide: ApiService, useValue: mockApiService },
  { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
  { provide: CollectionAdminService, useValue: mockCollectionAdminService },
  { provide: AccountService, useValue: mockAccountService },
];

export default {
  title: "Admin Console/Organizations/Groups/Group Add-Edit Dialog",
  decorators: [
    moduleMetadata({
      imports: [
        SharedOrganizationModule,
        Vfo1I18nPipe,
        CopyClickDirective,
        GroupAddDialogComponent,
        GroupEditDialogComponent,
      ],
      providers: sharedProviders,
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type AddStory = StoryObj<GroupAddDialogComponent>;
type EditStory = StoryObj<GroupEditDialogComponent>;

function makeAddRender(params: GroupAddDialogParams, org: Organization): AddStory["render"] {
  return () => ({
    moduleMetadata: {
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: OrganizationService, useValue: makeOrganizationService(org) },
        { provide: InternalGroupApiService, useValue: makeGroupService(undefined) },
      ],
    },
    template: `<app-group-add-dialog></app-group-add-dialog>`,
  });
}

function makeEditRender(
  params: GroupEditDialogParams,
  org: Organization,
  group: GroupDetailsView,
  vfo1Enabled = false,
): EditStory["render"] {
  return () => ({
    ...(vfo1Enabled
      ? {
          // Vfo1TerminologyService is `providedIn: "root"`, so its ConfigService dependency must
          // be overridden at the application root rather than in the story's moduleMetadata child
          // injector, which Vfo1TerminologyService can't see.
          applicationConfig: {
            providers: [{ provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } }],
          },
        }
      : {}),
    moduleMetadata: {
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: OrganizationService, useValue: makeOrganizationService(org) },
        { provide: InternalGroupApiService, useValue: makeGroupService(group) },
      ],
    },
    template: `<app-group-edit-dialog></app-group-edit-dialog>`,
  });
}

/** New group opened from the Groups page. */
export const CreateGroup: AddStory = {
  render: makeAddRender({ organizationId: ORG_ID }, mockOrganization()),
};

/** Existing group open for editing. */
export const EditGroup: EditStory = {
  render: makeEditRender(
    { organizationId: ORG_ID, groupId: GROUP_ID },
    mockOrganization(),
    mockGroupDetails,
  ),
};

/**
 * Group provisioned through Directory Connector — the read-only External ID field is shown on the
 * Group info tab with a copy button.
 */
export const EditGroupWithExternalId: Story = {
  render: makeRender(
    { organizationId: ORG_ID, groupId: GROUP_ID },
    mockOrganization(),
    mockGroupDetailsWithExternalId,
  ),
};

/**
 * Existing group opened directly on the Collections tab, with the VFO1 terminology flag on —
 * tab label, description text, and access-selector copy render "shared folder" terminology.
 */
export const EditGroupCollectionsTabVfo1Enabled: EditStory = {
  render: makeEditRender(
    { organizationId: ORG_ID, groupId: GROUP_ID, initialTab: GroupAddEditTabType.Collections },
    mockOrganization(),
    mockGroupDetails,
    true,
  ),
};
