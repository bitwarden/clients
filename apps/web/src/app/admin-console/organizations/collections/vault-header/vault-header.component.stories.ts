import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { LockService, LogoutService } from "@bitwarden/auth/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync/sync.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService } from "@bitwarden/components";
import { RoutedVaultFilterModel } from "@bitwarden/vault";

import { PreloadedEnglishI18nModule } from "../../../../core/tests";

import { VaultHeaderComponent } from "./vault-header.component";

@Component({
  selector: "app-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubHeaderComponent {
  title = "";
  icon = "";
}

function mockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1" as OrganizationId,
    name: "Acme Corp",
    enabled: true,
    canCreateNewCollections: true,
    canEditAnyCollection: true,
    canDeleteAnyCollection: true,
    maxCollections: 5,
    productTierType: ProductTierType.Teams,
    permissions: new PermissionsApi(),
    isProviderUser: false,
    isMember: true,
    ...overrides,
  } as unknown as Organization;
}

function mockCollection(
  name: string,
  id = "col-1" as CollectionId,
  orgId = "org-1" as OrganizationId,
): CollectionAdminView {
  const col = new CollectionAdminView({ id, organizationId: orgId, name });
  col.manage = true;
  col.assigned = true;
  return col;
}

function mockTreeNode(
  collection: CollectionAdminView,
  parent?: TreeNode<CollectionAdminView>,
): TreeNode<CollectionAdminView> {
  return new TreeNode<CollectionAdminView>(collection, parent as TreeNode<CollectionAdminView>);
}

const mockCollectionAdminService: Partial<CollectionAdminService> = {};
const mockDialogService: Partial<DialogService> = {};
const mockRestrictedItemTypesService: Partial<RestrictedItemTypesService> = { restricted$: of([]) };
const mockConfigService = { getFeatureFlag$: () => of(false) } as unknown as ConfigService;

const noop = () => of([]);
const rootProviders = [
  { provide: OrganizationService, useValue: { organizations$: noop } },
  { provide: ProviderService, useValue: { providers$: noop } },
  { provide: PolicyService, useValue: { policies$: noop, policiesByType$: noop } },
  {
    provide: AccountService,
    useValue: {
      activeAccount$: of({
        id: "user-1",
        email: "user@example.com",
        name: "Story User",
        emailVerified: true,
      }),
    },
  },
  { provide: PlatformUtilsService, useValue: { isSelfHost: () => false } },
  {
    provide: SyncService,
    useValue: { activeUserLastSync$: noop, getLastSync: () => Promise.resolve(null) },
  },
  {
    provide: BillingAccountProfileStateService,
    useValue: { hasPremiumPersonally$: noop, hasPremiumFromAnyOrganization$: noop },
  },
  { provide: VaultTimeoutSettingsService, useValue: { availableVaultTimeoutActions$: noop } },
  { provide: LogoutService, useValue: { logout: () => Promise.resolve(undefined) } },
  { provide: LockService, useValue: { lock: () => Promise.resolve() } },
];

type StoryArgs = {
  filter: RoutedVaultFilterModel;
  organization: Organization;
  collection?: TreeNode<CollectionAdminView>;
  loading: boolean;
  searchText: string;
};

const render: StoryObj<StoryArgs>["render"] = (args) => ({
  props: args,
  template: `
    <app-org-vault-header
      [filter]="filter"
      [organization]="organization"
      [collection]="collection"
      [loading]="loading"
      [searchText]="searchText"
    ></app-org-vault-header>
  `,
});

export default {
  title: "Admin Console/Organizations/Collections/Vault Header",
  component: VaultHeaderComponent,
  args: {
    filter: { organizationId: "org-1" as OrganizationId } satisfies RoutedVaultFilterModel,
    organization: mockOrganization(),
    collection: undefined,
    loading: false,
    searchText: "",
  },
  decorators: [
    moduleMetadata({
      imports: [VaultHeaderComponent, StubHeaderComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { data: of({ titleId: "" }), snapshot: { data: {} } },
        },
        { provide: CollectionAdminService, useValue: mockCollectionAdminService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: RestrictedItemTypesService, useValue: mockRestrictedItemTypesService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter([]),
        ...rootProviders,
      ],
    }),
  ],
} satisfies Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

/** Default org-level view — no collection selected, shows the org name header and "New" menu. */
export const OrgRoot: Story = { render };

/** A collection is selected — breadcrumbs and the edit/delete menu appear. */
export const CollectionSelected: Story = {
  args: {
    filter: { organizationId: "org-1" as OrganizationId, collectionId: "col-1" as CollectionId },
    collection: mockTreeNode(mockCollection("Engineering")),
  },
  render,
};

/** Nested collection — breadcrumbs show parent → child chain. */
export const NestedCollection: Story = {
  render: (args) => {
    const parent = mockTreeNode(mockCollection("Engineering", "col-1" as CollectionId));
    const child = mockTreeNode(mockCollection("Frontend", "col-2" as CollectionId), parent);
    parent.children = [child];
    return {
      props: {
        ...args,
        filter: {
          organizationId: "org-1" as OrganizationId,
          collectionId: "col-2" as CollectionId,
        },
        collection: child,
      },
      template: `<app-org-vault-header [filter]="filter" [organization]="organization" [collection]="collection" [loading]="loading" [searchText]="searchText"></app-org-vault-header>`,
    };
  },
};

/** Loading state — spinner shown next to the title. */
export const Loading: Story = { args: { loading: true }, render };

/** Unassigned filter — "New" menu is hidden, header shows "Unassigned". */
export const UnassignedFilter: Story = {
  args: { filter: { organizationId: "org-1" as OrganizationId, collectionId: "unassigned" } },
  render,
};

/** Trash filter — "New" menu is hidden. */
export const TrashFilter: Story = {
  args: { filter: { organizationId: "org-1" as OrganizationId, type: "trash" } },
  render,
};

/** Provider user who is not a direct member — search bar shown instead of "New" menu. */
export const ProviderUserNotMember: Story = {
  args: {
    organization: mockOrganization({ isProviderUser: true, isMember: false }),
    searchText: "find me",
  },
  render,
};

/** Collection selected but the current user only has read access — view-only info/access buttons shown. */
export const ReadOnlyCollection: Story = {
  render: (args) => {
    const col = mockCollection("Read-Only Vault");
    col.manage = false;
    return {
      props: {
        ...args,
        filter: { organizationId: "org-1" as OrganizationId, collectionId: col.id },
        organization: mockOrganization({
          canEditAnyCollection: false,
          canDeleteAnyCollection: false,
        }),
        collection: mockTreeNode(col),
      },
      template: `<app-org-vault-header [filter]="filter" [organization]="organization" [collection]="collection" [loading]="loading" [searchText]="searchText"></app-org-vault-header>`,
    };
  },
};
