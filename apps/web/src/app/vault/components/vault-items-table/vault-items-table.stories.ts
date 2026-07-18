// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import {
  CollectionAccessSelectionView,
  CollectionAdminView,
  Unassigned,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  LayoutComponent,
  StorybookGlobalStateProvider,
  TableDataSource,
} from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";
import { VaultItem } from "@bitwarden/vault";

import { GroupView } from "../../../admin-console/organizations/core";
import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { VaultItemsTableComponent, VaultItemsTableMode } from "./vault-items-table.component";
import { toVaultRow, VaultRow } from "./vault-row";

const organizations = [...new Array(3).keys()].map(createOrganization);
const groups = [...Array(3).keys()].map(createGroupView);
const collections = [...Array(5).keys()].map(createCollectionView);
const ciphers = [...Array(50).keys()].map((i) => createCipherView(i));
const deletedCiphers = [...Array(15).keys()].map((i) => createCipherView(i, true));
const organizationOnlyCiphers = ciphers.filter((c) => c.organizationId != undefined);

/** Build the rows the table consumes, enriching the policy-derived fields the consumer owns. */
function buildRows(
  storyCollections: CollectionAdminView[],
  storyCiphers: CipherView[],
): TableDataSource<VaultRow> {
  const items: VaultItem<CipherView>[] = [
    ...storyCollections.map((collection) => ({ collection })),
    ...storyCiphers.map((cipher) => ({ cipher })),
  ];
  const rows = items.map((item) => {
    const row = toVaultRow(item);
    // The consumer resolves policy onto the row.
    row.permissionText = row.kind === "collection" ? "Manage" : "Can edit";
    row.permissionPriority = row.kind === "collection" ? 5 : 4;
    row.canEdit = true;
    row.canDelete = true;
    row.canArchive = row.kind === "cipher";
    row.canEditAccess = row.kind === "collection";
    return row;
  });
  const dataSource = new TableDataSource<VaultRow>();
  dataSource.data = rows;
  return dataSource;
}

type StoryArgs = {
  ciphers: CipherView[];
  collections: CollectionAdminView[];
  disabled: boolean;
  mode: VaultItemsTableMode;
};

export default {
  title: "Web/Vault/Items Table",
  component: VaultItemsTableComponent,
  decorators: [
    componentWrapperDecorator((story) => `<bit-layout>${story}</bit-layout>`),
    moduleMetadata({
      imports: [RouterModule, LayoutComponent, VaultItemsTableComponent],
      providers: [
        {
          provide: EnvironmentService,
          useValue: {
            getIconsUrl() {
              return "";
            },
            environment$: new BehaviorSubject({
              getIconsUrl() {
                return "";
              },
            } as Environment).asObservable(),
          } as Partial<EnvironmentService>,
        },
        {
          provide: StateService,
          useValue: {
            accounts$: new BehaviorSubject({ "1": { profile: { name: "Foo" } } }).asObservable(),
            async getShowFavicon() {
              return true;
            },
          } as Partial<StateService>,
        },
        {
          provide: DomainSettingsService,
          useValue: {
            showFavicons$: new BehaviorSubject(true).asObservable(),
            getShowFavicon() {
              return true;
            },
          } as Partial<DomainSettingsService>,
        },
        {
          provide: AvatarService,
          useValue: {
            avatarColor$: of("#FF0000"),
          } as Partial<AvatarService>,
        },
        {
          provide: ConfigService,
          useValue: {
            // Needed by the projected `app-vault-icon`, not by the table itself.
            getFeatureFlag$() {
              return of(false);
            },
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(RouterModule.forRoot([], { useHash: true })),
        importProvidersFrom(PreloadedEnglishI18nModule),
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
      ],
    }),
  ],
  args: {
    disabled: false,
  },
  argTypes: { rowClick: { action: "rowClick" } },
  render: (args: StoryArgs) => ({
    props: {
      ...args,
      dataSource: buildRows(args.collections ?? [], args.ciphers ?? []),
      selection: new SelectionModel<VaultRow>(true, []),
      allOrganizations: organizations,
      allCollections: collections,
      allGroups: groups,
      rowClick: (row: VaultRow) => row,
    },
    template: `
      <app-vault-items-table
        [dataSource]="dataSource"
        [selection]="selection"
        [mode]="mode"
        [allOrganizations]="allOrganizations"
        [allCollections]="allCollections"
        [allGroups]="allGroups"
        [disabled]="disabled"
        (rowClick)="rowClick($event)"
      ></app-vault-items-table>
    `,
  }),
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

export const Individual: Story = {
  args: {
    ciphers,
    collections: [],
    mode: "individual",
  },
};

export const IndividualTrash: Story = {
  args: {
    ciphers: deletedCiphers,
    collections: [],
    mode: "individual",
  },
};

export const IndividualTopLevelCollection: Story = {
  args: {
    ciphers: [],
    collections,
    mode: "individual",
  },
};

export const OrganizationVault: Story = {
  args: {
    ciphers: organizationOnlyCiphers,
    collections: [],
    mode: "organization",
  },
};

const unassignedCollection = new CollectionAdminView({
  id: Unassigned as CollectionId,
  name: "Unassigned",
  organizationId: "org id" as OrganizationId,
});

export const OrganizationCollections: Story = {
  args: {
    ciphers: organizationOnlyCiphers,
    collections: collections.concat(unassignedCollection),
    mode: "organization",
  },
};

function createCipherView(i: number, deleted = false): CipherView {
  const organization = organizations[i % (organizations.length + 1)];
  const collection = collections[i % (collections.length + 1)];
  const view = new CipherView();
  view.id = `cipher-${i}`;
  view.name = `Vault item ${i}`;
  view.type = CipherType.Login;
  view.organizationId = organization?.id;
  view.deletedDate = deleted ? new Date() : undefined;
  view.login = new LoginView();
  view.login.username = i % 10 === 0 ? undefined : `username-${i}`;
  view.login.uris = [new LoginUriView()];
  view.login.uris[0].uri = "https://bitwarden.com";
  view.collectionIds = collection ? [collection.id] : [];
  return view;
}

function createCollectionView(i: number): CollectionAdminView {
  const organization = organizations[i % (organizations.length + 1)];
  const group = groups[i % (groups.length + 1)];
  const view = new CollectionAdminView({
    id: `collection-${i}` as CollectionId,
    name: `Collection ${i}`,
    organizationId: organization?.id ?? ("orgId" as OrganizationId),
  });

  if (group !== undefined) {
    view.groups = [
      new CollectionAccessSelectionView({
        id: group.id,
        hidePasswords: false,
        readOnly: false,
        manage: false,
      }),
    ];
  }

  view.manage = true;
  return view;
}

function createGroupView(i: number): GroupView {
  const organization = organizations[i % organizations.length];
  const view = new GroupView();
  view.id = `group-${i}`;
  view.name = `Group ${i}`;
  view.organizationId = organization.id;
  return view;
}

function createOrganization(i: number): Organization {
  const organization = new Organization();
  organization.id = `organization-${i}` as OrganizationId;
  organization.name = `Organization ${i}`;
  organization.type = OrganizationUserType.Owner;
  organization.permissions = new PermissionsApi();
  return organization;
}
