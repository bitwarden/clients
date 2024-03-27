import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, Story } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CipherType } from "@bitwarden/common/vault/enums";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import {
  CollectionAccessSelectionView,
  GroupView,
} from "../../../admin-console/organizations/core";
import { PreloadedEnglishI18nModule } from "../../../core/tests";
import { CollectionAdminView } from "../../core/views/collection-admin.view";
import { Unassigned } from "../../individual-vault/vault-filter/shared/models/routed-vault-filter.model";

import { VaultItemsComponent } from "./vault-items.component";
import { VaultItemsModule } from "./vault-items.module";

const organizations = [...new Array(3).keys()].map(createOrganization);
const groups = [...Array(3).keys()].map(createGroupView);
const collections = [...Array(5).keys()].map(createCollectionView);
const ciphers = [...Array(50).keys()].map((i) => createCipherView(i));
const deletedCiphers = [...Array(15).keys()].map((i) => createCipherView(i, true));
const organizationOnlyCiphers = ciphers.filter((c) => c.organizationId != undefined);
const deletedOrganizationOnlyCiphers = deletedCiphers.filter((c) => c.organizationId != undefined);

export default {
  title: "Web/Vault/Items",
  component: VaultItemsComponent,
  decorators: [
    moduleMetadata({
      imports: [VaultItemsModule, RouterModule],
      providers: [
        {
          provide: EnvironmentService,
          useValue: {
            getIconsUrl() {
              return "";
            },
          } as Partial<EnvironmentService>,
        },
        {
          provide: StateService,
          useValue: {
            activeAccount$: new BehaviorSubject("1").asObservable(),
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
          provide: TokenService,
          useValue: {
            async getUserId() {
              return "user-id";
            },
            async getName() {
              return "name";
            },
            async getEmail() {
              return "email";
            },
          } as Partial<TokenService>,
        },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag() {
              // does not currently affect any display logic, default all to OFF
              return false;
            },
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(RouterModule.forRoot([], { useHash: true })),
        importProvidersFrom(PreloadedEnglishI18nModule),
      ],
    }),
  ],
  args: {
    disabled: false,
    allCollections: collections,
    allGroups: groups,
    allOrganizations: organizations,
  },
  argTypes: { onEvent: { action: "onEvent" } },
} as Meta;

const Template: Story<VaultItemsComponent> = (args: VaultItemsComponent) => ({
  props: args,
});

export const Individual = Template.bind({});
Individual.args = {
  ciphers,
  collections: [],
  showOwner: true,
  showCollections: false,
  showGroups: false,
  showPremiumFeatures: true,
  showBulkMove: true,
  showBulkTrashOptions: false,
  useEvents: false,
  cloneableOrganizationCiphers: false,
};

export const IndividualDisabled = Template.bind({});
IndividualDisabled.args = {
  ciphers,
  collections: [],
  disabled: true,
  showOwner: true,
  showCollections: false,
  showGroups: false,
  showPremiumFeatures: true,
  showBulkMove: true,
  showBulkTrashOptions: false,
  useEvents: false,
  cloneableOrganizationCiphers: false,
};

export const IndividualTrash = Template.bind({});
IndividualTrash.args = {
  ciphers: deletedCiphers,
  collections: [],
  showOwner: true,
  showCollections: false,
  showGroups: false,
  showPremiumFeatures: true,
  showBulkMove: false,
  showBulkTrashOptions: true,
  useEvents: false,
  cloneableOrganizationCiphers: false,
};

export const IndividualTopLevelCollection = Template.bind({});
IndividualTopLevelCollection.args = {
  ciphers: [],
  collections,
  showOwner: true,
  showCollections: false,
  showGroups: false,
  showPremiumFeatures: true,
  showBulkMove: false,
  showBulkTrashOptions: false,
  useEvents: false,
  cloneableOrganizationCiphers: false,
};

export const IndividualSecondLevelCollection = Template.bind({});
IndividualSecondLevelCollection.args = {
  ciphers,
  collections,
  showOwner: true,
  showCollections: false,
  showGroups: false,
  showPremiumFeatures: true,
  showBulkMove: true,
  showBulkTrashOptions: false,
  useEvents: false,
  cloneableOrganizationCiphers: false,
};

export const OrganizationVault = Template.bind({});
OrganizationVault.args = {
  ciphers: organizationOnlyCiphers,
  collections: [],
  showOwner: false,
  showCollections: true,
  showGroups: false,
  showPremiumFeatures: true,
  showBulkMove: false,
  showBulkTrashOptions: false,
  useEvents: true,
  cloneableOrganizationCiphers: true,
};

export const OrganizationTrash = Template.bind({});
OrganizationTrash.args = {
  ciphers: deletedOrganizationOnlyCiphers,
  collections: [],
  showOwner: false,
  showCollections: true,
  showGroups: false,
  showPremiumFeatures: true,
  showBulkMove: false,
  showBulkTrashOptions: true,
  useEvents: true,
  cloneableOrganizationCiphers: true,
};

const unassignedCollection = new CollectionAdminView();
unassignedCollection.id = Unassigned;
unassignedCollection.name = "Unassigned";
export const OrganizationTopLevelCollection = Template.bind({});
OrganizationTopLevelCollection.args = {
  ciphers: [],
  collections: collections.concat(unassignedCollection),
  showOwner: false,
  showCollections: false,
  showGroups: true,
  showPremiumFeatures: true,
  showBulkMove: false,
  showBulkTrashOptions: false,
  useEvents: true,
  cloneableOrganizationCiphers: true,
};

export const OrganizationSecondLevelCollection = Template.bind({});
OrganizationSecondLevelCollection.args = {
  ciphers: organizationOnlyCiphers,
  collections,
  showOwner: false,
  showCollections: false,
  showGroups: true,
  showPremiumFeatures: true,
  showBulkMove: false,
  showBulkTrashOptions: false,
  useEvents: true,
  cloneableOrganizationCiphers: true,
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
  view.login.totp = i % 2 === 0 ? "I65VU7K5ZQL7WB4E" : undefined;
  view.login.uris = [new LoginUriView()];
  view.login.uris[0].uri = "https://bitwarden.com";
  view.collectionIds = collection ? [collection.id] : [];

  if (i === 0) {
    // Old attachment
    const attachment = new AttachmentView();
    view.organizationId = null;
    view.collectionIds = [];
    view.attachments = [attachment];
  } else if (i % 5 === 0) {
    const attachment = new AttachmentView();
    attachment.key = new SymmetricCryptoKey(new Uint8Array(32));
    view.attachments = [attachment];
  }

  return view;
}

function createCollectionView(i: number): CollectionAdminView {
  const organization = organizations[i % (organizations.length + 1)];
  const group = groups[i % (groups.length + 1)];
  const view = new CollectionAdminView();
  view.id = `collection-${i}`;
  view.name = `Collection ${i}`;
  view.organizationId = organization?.id;

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
  organization.id = `organization-${i}`;
  organization.name = `Organization ${i}`;
  organization.type = OrganizationUserType.Owner;
  return organization;
}
