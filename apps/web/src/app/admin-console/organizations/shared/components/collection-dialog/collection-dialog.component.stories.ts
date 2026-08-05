import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import {
  CollectionAdminService,
  CollectionService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { enabledFlags } from "@bitwarden/storybook";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";
import { GroupApiService, GroupView } from "../../../core";

import { CollectionDialogComponent } from "./collection-dialog.component";
import { CollectionDialogParams, CollectionDialogTabType } from "./collection-dialog.models";

const ORG_ID = "org-1" as OrganizationId;
const COLLECTION_ID = "col-1" as CollectionId;
const USER_ID = "user-1" as UserId;

function mockOrganization(overrides: Partial<Organization> = {}): Organization {
  return Object.assign(new Organization(), {
    id: ORG_ID,
    name: "Acme Corp",
    useGroups: true,
    allowAdminAccessToAllCollectionItems: true,
    // type=Admin makes isAdmin→true, which drives canViewAllCollections and canCreateNewCollections
    type: OrganizationUserType.Admin,
    isProviderUser: false,
    permissions: new PermissionsApi(),
    productTierType: ProductTierType.Teams,
    ...overrides,
  });
}

const mockCollection = Object.assign(
  new CollectionAdminView({ id: COLLECTION_ID, organizationId: ORG_ID, name: "Engineering" }),
  {
    externalId: "eng-ext",
    groups: [],
    users: [],
    manage: true,
  },
);

// Parent named "DeletedParent" does not exist in the returned collection list,
// so the component will detect it as deleted and show the placeholder option.
const mockNestedCollection = Object.assign(
  new CollectionAdminView({
    id: COLLECTION_ID,
    organizationId: ORG_ID,
    name: "DeletedParent/Engineering",
  }),
  {
    externalId: "",
    groups: [],
    users: [],
    manage: true,
  },
);

const mockGroups: GroupView[] = [
  new GroupView({ id: "grp-1", organizationId: ORG_ID, name: "Admins" }),
  new GroupView({ id: "grp-2", organizationId: ORG_ID, name: "Developers" }),
];

const mockUsers = {
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

const mockDialogRef = { close: () => {} };

const mockDialogService = {
  open: () => ({ closed: of(undefined) }),
  openSimpleDialog: () => Promise.resolve(false),
};

const mockToastService = { showToast: () => {} };

const mockAccountService = {
  activeAccount$: new BehaviorSubject({ id: USER_ID, email: "alice@example.com" }),
};

const mockGroupApiService = {
  getAll: () => of(mockGroups),
};

const mockOrganizationUserApiService = {
  getAllMiniUserDetails: () => of(mockUsers),
};

const mockCollectionService = {
  encryptedCollections$: () => of([]),
};

function makeOrganizationService(org: Organization) {
  const orgs$ = new BehaviorSubject([org]);
  return { organizations$: () => orgs$.asObservable() };
}

function makeCollectionAdminService(collection?: CollectionAdminView) {
  const cols = collection ? [collection] : [];
  const cols$ = new BehaviorSubject(cols);
  return { collectionAdminViews$: () => cols$.asObservable() };
}

export default {
  title: "Admin Console/Organizations/Collections/Collection Dialog",
  component: CollectionDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CollectionDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useValue: mockDialogService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ToastService, useValue: mockToastService },
        { provide: GroupApiService, useValue: mockGroupApiService },
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        { provide: CollectionService, useValue: mockCollectionService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<CollectionDialogComponent>;

function makeRender(
  params: CollectionDialogParams,
  org: Organization,
  collection?: CollectionAdminView,
): Story["render"] {
  return () => ({
    moduleMetadata: {
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: OrganizationService, useValue: makeOrganizationService(org) },
        { provide: CollectionAdminService, useValue: makeCollectionAdminService(collection) },
      ],
    },
    template: `<app-collection-dialog></app-collection-dialog>`,
  });
}

/** New collection opened from the org vault. */
export const CreateCollection: Story = {
  render: makeRender({ organizationId: ORG_ID }, mockOrganization()),
};

/** New collection opened from the individual vault — shows the org selector dropdown. */
export const CreateCollectionOrgSelector: Story = {
  render: makeRender({ organizationId: ORG_ID, showOrgSelector: true }, mockOrganization()),
};

/** Existing collection open for editing. ExternalId is visible because isAdminConsoleActive is set. */
export const EditCollection: Story = {
  render: makeRender(
    { organizationId: ORG_ID, collectionId: COLLECTION_ID, isAdminConsoleActive: true },
    mockOrganization(),
    mockCollection,
  ),
};

/** Existing collection opened read-only — all fields disabled, no save or delete buttons. */
export const EditCollectionReadonly: Story = {
  render: makeRender(
    { organizationId: ORG_ID, collectionId: COLLECTION_ID, readonly: true },
    mockOrganization(),
    mockCollection,
  ),
};

/** Existing collection opened directly on the Access tab. */
export const EditCollectionAccessTab: Story = {
  render: makeRender(
    {
      organizationId: ORG_ID,
      collectionId: COLLECTION_ID,
      initialTab: CollectionDialogTabType.Access,
    },
    mockOrganization(),
    mockCollection,
  ),
};

/**
 * Existing collection whose parent was deleted — the nesting selector shows a
 * disabled placeholder entry for the missing parent.
 */
export const EditCollectionDeletedParent: Story = {
  render: makeRender(
    { organizationId: ORG_ID, collectionId: COLLECTION_ID },
    mockOrganization(),
    mockNestedCollection,
  ),
};

/**
 * New collection with the VFO1 terminology flag on — labels, info text, and access
 * copy render "shared folder" terminology instead of "collection".
 */
export const CreateCollectionVfo1Enabled: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: makeRender({ organizationId: ORG_ID }, mockOrganization()),
};

/**
 * Existing collection open for editing with the VFO1 terminology flag on — the Access
 * tab's Manage permission label renders "Manage" (not "Manage shared folder").
 */
export const EditCollectionVfo1Enabled: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: makeRender(
    {
      organizationId: ORG_ID,
      collectionId: COLLECTION_ID,
      isAdminConsoleActive: true,
      initialTab: CollectionDialogTabType.Access,
    },
    mockOrganization(),
    mockCollection,
  ),
};
