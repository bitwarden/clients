import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { ButtonModule, I18nMockService } from "@bitwarden/components";

import { CopyCipherFieldService } from "../../services/copy-cipher-field.service";
import { VaultItemEvent } from "../vault-item-event";

import { VaultItemsTableRowAction } from "./vault-items-table-row-action";
import { VaultItemsTableComponent } from "./vault-items-table.component";

const organizations = [
  { id: "org-1", name: "Acme corporation" },
  { id: "org-2", name: "Contoso" },
] as Organization[];

const collections = [
  { id: "col-1", name: "Operations" },
  { id: "col-2", name: "Engineering" },
  { id: "col-3", name: "Finance" },
] as CollectionView[];

const folders = [
  { id: "folder-1", name: "Work" },
  { id: "folder-2", name: "Finance" },
] as FolderView[];

type CipherFixture = {
  id: string;
  name: string;
  username?: string;
  password?: string;
  totp?: string;
  uri?: string;
  type?: CipherType;
  /** Omit for an item in the individual vault. */
  organizationId?: string;
  folderId?: string;
  /** Only meaningful alongside `organizationId` — see {@link cipher}. */
  collectionIds?: string[];
  favorite?: boolean;
  attachments?: number;
};

function cipher(fixture: CipherFixture): CipherView {
  // Shared folders are an organization construct, so an item in the individual vault can't
  // belong to one. Fail loudly rather than render a state the product can't produce.
  if (!fixture.organizationId && fixture.collectionIds?.length) {
    throw new Error(
      `Fixture "${fixture.name}" is in the individual vault but has shared folders; ` +
        "only organization-owned items can belong to a shared folder.",
    );
  }

  const view = new CipherView();
  view.id = fixture.id;
  view.name = fixture.name;
  view.type = fixture.type ?? CipherType.Login;
  view.favorite = fixture.favorite ?? false;
  view.organizationId = (fixture.organizationId ?? null) as never;
  view.folderId = (fixture.folderId ?? null) as never;
  view.collectionIds = (fixture.collectionIds ?? []) as never;
  view.attachments = Array.from({ length: fixture.attachments ?? 0 }, () => new AttachmentView());

  if (view.type === CipherType.Login) {
    view.login.username = fixture.username ?? "";
    view.login.password = fixture.password ?? "";
    view.login.totp = fixture.totp ?? "";
    if (fixture.uri) {
      const uri = new LoginUriView();
      uri.uri = fixture.uri;
      view.login.uris = [uri];
    }
  }

  return view;
}

/**
 * A cross-section of the states the table has to render: individual-vault and organization-owned
 * items, single and multiple shared folders, filed and unfiled, favorited, with an attachment,
 * and a spread of cipher types (which drives how many quick copy actions a row reveals).
 */
const ciphers = [
  {
    id: "1",
    name: "Acme",
    username: "d.finnegan@acme.com",
    password: "pw",
    uri: "https://acme.com",
    folderId: "folder-1",
  },
  {
    id: "2",
    name: "Amazon",
    username: "d.finnegan@acme.com",
    password: "pw",
    totp: "otpauth://totp/amazon",
    uri: "https://amazon.com",
    organizationId: "org-1",
    collectionIds: ["col-1", "col-3"],
    folderId: "folder-1",
  },
  {
    id: "3",
    name: "Amazon",
    username: "derekfinnegan@gmail.com",
    password: "pw",
    uri: "https://amazon.com",
    favorite: true,
  },
  { id: "4", name: "Apple ID", username: "derekfinnegan@gmail.com", password: "pw" },
  {
    id: "5",
    name: "AWS root account",
    username: "d.finnegan@acme.com",
    password: "pw",
    totp: "otpauth://totp/aws",
    uri: "https://aws.amazon.com",
    organizationId: "org-1",
    collectionIds: ["col-2", "col-3"],
    folderId: "folder-1",
  },
  {
    id: "6",
    name: "Chase Bank",
    type: CipherType.Card,
    folderId: "folder-2",
    // Shows the attachment indicator beside the name.
    attachments: 1,
  },
  {
    id: "7",
    name: "CircleCI",
    username: "d.finnegan@acme.com",
    password: "pw",
    uri: "https://circleci.com",
    organizationId: "org-2",
    collectionIds: ["col-2"],
    folderId: "folder-1",
  },
  {
    id: "8",
    name: "Personal notes",
    type: CipherType.SecureNote,
    favorite: true,
    attachments: 2,
  },
].map(cipher);

/** Web's overflow set for this story: Edit and Event Logs, both built by the client. */
const rowActions: VaultItemsTableRowAction<CipherView, VaultItemEvent<CipherView>>[] = [
  {
    id: "edit",
    label: "Edit",
    icon: "bwi-pencil-square",
    event: (item) => ({ type: "editCipher", item }),
  },
  {
    id: "events",
    label: "Event logs",
    icon: "bwi-file-text",
    // Event logs only exist for organization-owned items.
    show: (item) => item.organizationId != null,
    event: (item) => ({ type: "viewEvents", item }),
  },
];

export default {
  title: "Vault/Vault Items Table",
  component: VaultItemsTableComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule],
      providers: [
        {
          // Real English copy rather than key echoes, so design review sees what ships. Values
          // are lifted verbatim from apps/web/src/locales/en/messages.json; `__$n__` are
          // I18nMockService's placeholder markers for the keys that take arguments.
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              // Toolbar
              search: "Search",
              resetSearch: "Reset search",
              type: "Type",
              all: "All",
              favorites: "Favorites",
              vault: "Vault",
              myVault: "My vault",
              sharedFolders: "Shared folders",
              myFolders: "My folders",
              noneFolder: "No folder",
              noSharedFolder: "No shared folder",
              itemCount: (count) => `${count} items`,
              filter: "Filter",
              filters: "Filters",
              done: "Done",
              clearAll: "Clear all",
              filtersSelected: (count) => `${count} selected`,
              // Cipher types, for the Type chip
              typeLogin: "Login",
              typeCard: "Card",
              typeIdentity: "Identity",
              typeSecureNote: "Secure note",
              typeSshKey: "SSH key",
              typeBankAccount: "Bank account",
              typeDriversLicense: "License",
              typePassport: "Passport",
              // Columns and rows
              name: "Name",
              organization: "Organization",
              editItemWithName: (name) => `Edit item - ${name}`,
              favorite: "Favorite",
              attachments: "Attachments",
              options: "Options",
              optionsForItem: (name) => `Options for ${name}`,
              launchWebsiteName: (name) => `Launch website ${name}`,
              selectAllRows: "Select all rows",
              selectRow: "Select row",
              // Empty states
              nothingToShow: "Nothing to show",
              noMatchingItems: "No matching items",
              clearFiltersOrTryAnother: "Clear filters or try another search term",
              noItemsInVault: "No items in the vault",
              emptyVaultDescription:
                "The vault protects more than just your passwords. Store secure logins, IDs, cards and notes securely here.",
              // Copy quick actions
              copyUsername: "Copy username",
              copyPassword: "Copy password",
              copyVerificationCode: "Copy verification code",
              copyNumber: "Copy number",
              copySecurityCode: "Copy security code",
              copyNote: "Copy note",
              copyEmail: "Copy email",
              copyPhone: "Copy phone",
              copyAddress: "Copy address",
              copyInfoTitle: (name) => `Copy info - ${name}`,
              copyFieldCipherName: (field, name) => `Copy ${field}, ${name}`,
              noValuesToCopy: "No values to copy",
              valueCopied: (value) => `${value} copied`,
            }),
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "user-1" }) },
        },
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        { provide: CipherService, useValue: { updateLastLaunchedDate: () => Promise.resolve() } },
        { provide: PlatformUtilsService, useValue: { launchUri: (): void => undefined } },
        {
          provide: CopyCipherFieldService,
          useValue: { copy: () => Promise.resolve(true), totpAllowed: () => Promise.resolve(true) },
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<VaultItemsTableComponent<CipherView>>;

const template = `
  <vault-items-table
    [ciphers]="ciphers"
    [loading]="loading"
    [rowActions]="rowActions"
    [folders]="folders"
    [collections]="collections"
    [organizations]="organizations"
    [itemAction]="itemAction"
    (action)="onAction($event)"
  >
    <button slot="toolbar" bitButton buttonType="secondary" type="button" startIcon="bwi-import">
      Import
    </button>
    <button slot="toolbar" bitButton buttonType="primary" type="button" startIcon="bwi-plus">
      Add
    </button>
  </vault-items-table>
`;

const baseProps = {
  ciphers,
  loading: false,
  rowActions,
  folders,
  collections,
  organizations,
  itemAction: (item: CipherView) => ({ type: "editCipher", item }),
  onAction: (event: VaultItemEvent<CipherView>) => {
    // eslint-disable-next-line no-console
    console.log("event", event);
  },
};

/**
 * The default state. Hover or keyboard-focus a row to reveal the Launch and Copy quick actions
 * beside the overflow menu.
 */
export const Default: Story = {
  render: () => ({ props: { ...baseProps }, template }),
};

/** Skeleton rows stand in for data while the vault decrypts. */
export const Loading: Story = {
  render: () => ({ props: { ...baseProps, loading: true }, template }),
};

/** No data at all — distinct from a filter that excluded everything. */
export const Empty: Story = {
  render: () => ({ props: { ...baseProps, ciphers: [] }, template }),
};

/**
 * There is data, but nothing survives the active filter. Type in the search box to reach this
 * state; the copy differs from {@link Empty} because the fix is to clear filters, not add items.
 */
export const FilteredToZero: Story = {
  render: () => ({
    props: {
      ...baseProps,
      ciphers: [cipher({ id: "1", name: "Amazon", username: "derek@example.com" })],
    },
    template,
  }),
  play: async ({ canvasElement }) => {
    const search = canvasElement.querySelector("input") as HTMLInputElement;
    search.value = "no-such-item";
    search.dispatchEvent(new Event("input", { bubbles: true }));
  },
};

/** Without organizations the Vault chip has nothing to offer, so it doesn't render. */
export const IndividualVaultOnly: Story = {
  render: () => ({
    props: {
      ...baseProps,
      organizations: [],
      ciphers: ciphers.filter((c) => !c.organizationId),
    },
    template,
  }),
};

/** Template variant that also binds the Copy presentation style. */
const copyPresentationTemplate = template.replace(
  '[rowActions]="rowActions"',
  '[rowActions]="rowActions" [copyPresentation]="copyPresentation"',
);

/**
 * `copyPresentation: "expanded"` gives each copyable field its own button — for a login, username,
 * password and TOTP. Hover a row to compare against {@link Default}'s collapsed single button. The
 * actions column widens to 240px to hold them, which is why collapsed is the default.
 */
export const ExpandedCopyActions: Story = {
  render: () => ({
    props: {
      ...baseProps,
      copyPresentation: "expanded",
    },
    template: copyPresentationTemplate,
  }),
};
