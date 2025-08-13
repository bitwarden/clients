// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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

import {
  CollectionAccessSelectionView,
  CollectionAdminView,
  Unassigned,
} from "@bitwarden/admin-console/common";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { LayoutComponent } from "@bitwarden/components";

import { GroupView } from "../../../admin-console/organizations/core";
import { PreloadedEnglishI18nModule } from "../../../core/tests";

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
    componentWrapperDecorator((story) => `<bit-layout>${story}</bit-layout>`),
    moduleMetadata({
      imports: [VaultItemsModule, RouterModule, LayoutComponent],
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
            getFeatureFlag$() {
              // does not currently affect any display logic, default all to OFF
              return false;
            },
          },
        },
        {
          provide: CipherAuthorizationService,
          useValue: {
            canDeleteCipher$() {
              return of(true);
            },
            canRestoreCipher$() {
              return of(true);
            },
            canCloneCipher$() {
              return of(true);
            },
          },
        },
        {
          provide: RestrictedItemTypesService,
          useValue: {
            restricted$: of([]), // No restricted item types for this story
            isCipherRestricted: () => false, // No restrictions for this story
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

type Story = StoryObj<VaultItemsComponent<CipherViewLike>>;

export const Individual: Story = {
  args: {
    ciphers,
    collections: [],
    showOwner: true,
    showCollections: false,
    showGroups: false,
    showPremiumFeatures: true,
    showBulkMove: true,
    showBulkTrashOptions: false,
    useEvents: false,
  },
};

export const IndividualDisabled: Story = {
  args: {
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
  },
};

export const IndividualTrash: Story = {
  args: {
    ciphers: deletedCiphers,
    collections: [],
    showOwner: true,
    showCollections: false,
    showGroups: false,
    showPremiumFeatures: true,
    showBulkMove: false,
    showBulkTrashOptions: true,
    useEvents: false,
  },
};

export const IndividualTopLevelCollection: Story = {
  args: {
    ciphers: [],
    collections,
    showOwner: true,
    showCollections: false,
    showGroups: false,
    showPremiumFeatures: true,
    showBulkMove: false,
    showBulkTrashOptions: false,
    useEvents: false,
  },
};

export const IndividualSecondLevelCollection: Story = {
  args: {
    ciphers,
    collections,
    showOwner: true,
    showCollections: false,
    showGroups: false,
    showPremiumFeatures: true,
    showBulkMove: true,
    showBulkTrashOptions: false,
    useEvents: false,
  },
};

export const OrganizationVault: Story = {
  args: {
    ciphers: organizationOnlyCiphers,
    collections: [],
    showOwner: false,
    showCollections: true,
    showGroups: false,
    showPremiumFeatures: true,
    showBulkMove: false,
    showBulkTrashOptions: false,
    useEvents: true,
  },
};

export const OrganizationTrash: Story = {
  args: {
    ciphers: deletedOrganizationOnlyCiphers,
    collections: [],
    showOwner: false,
    showCollections: true,
    showGroups: false,
    showPremiumFeatures: true,
    showBulkMove: false,
    showBulkTrashOptions: true,
    useEvents: true,
  },
};

const unassignedCollection = new CollectionAdminView();
unassignedCollection.id = Unassigned as CollectionId;
unassignedCollection.name = "Unassigned";
export const OrganizationTopLevelCollection: Story = {
  args: {
    ciphers: [],
    collections: collections.concat(unassignedCollection),
    showOwner: false,
    showCollections: false,
    showGroups: true,
    showPremiumFeatures: true,
    showBulkMove: false,
    showBulkTrashOptions: false,
    useEvents: true,
  },
};

export const OrganizationSecondLevelCollection: Story = {
  args: {
    ciphers: organizationOnlyCiphers,
    collections,
    showOwner: false,
    showCollections: false,
    showGroups: true,
    showPremiumFeatures: true,
    showBulkMove: false,
    showBulkTrashOptions: false,
    useEvents: true,
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
  view.id = `collection-${i}` as CollectionId;
  view.name = `Collection ${i}`;
  view.organizationId = organization?.id;
  view.manage = true;

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
  organization.id = `organization-${i}` as OrganizationId;
  organization.name = `Organization ${i}`;
  organization.type = OrganizationUserType.Owner;
  organization.permissions = new PermissionsApi();
  return organization;
}
