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

/**
 * 12 collections split across the two organizations above the `SEARCH_THRESHOLD`
 * `bit-filter-menu` uses to show its in-menu search (10, exclusive) — see {@link ManySharedFolders}.
 * `organizationId` is set on every entry, unlike {@link collections}, because the Shared folders
 * chip groups by it once there are enough to warrant sections.
 */
const manyCollections = [
  { id: "col-eng", name: "Engineering", organizationId: "org-1" },
  { id: "col-ops", name: "Operations", organizationId: "org-1" },
  { id: "col-design", name: "Design", organizationId: "org-1" },
  { id: "col-security", name: "Security", organizationId: "org-1" },
  { id: "col-infra", name: "Infrastructure", organizationId: "org-1" },
  { id: "col-hr", name: "Human resources", organizationId: "org-1" },
  { id: "col-marketing", name: "Marketing", organizationId: "org-2" },
  { id: "col-sales", name: "Sales", organizationId: "org-2" },
  { id: "col-support", name: "Support", organizationId: "org-2" },
  { id: "col-finance", name: "Finance", organizationId: "org-2" },
  { id: "col-legal", name: "Legal", organizationId: "org-2" },
  { id: "col-it", name: "IT", organizationId: "org-2" },
] as CollectionView[];

/** 12 folders, above the same threshold — see {@link ManyFolders}. */
const manyFolders = [
  { id: "folder-a", name: "Work" },
  { id: "folder-b", name: "Personal" },
  { id: "folder-c", name: "Finance" },
  { id: "folder-d", name: "Travel" },
  { id: "folder-e", name: "Shopping" },
  { id: "folder-f", name: "Health" },
  { id: "folder-g", name: "Education" },
  { id: "folder-h", name: "Entertainment" },
  { id: "folder-i", name: "Utilities" },
  { id: "folder-j", name: "Insurance" },
  { id: "folder-k", name: "Legal" },
  { id: "folder-l", name: "Subscriptions" },
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

/**
 * Expands one spec into `count` items, so the fixtures below can describe a *distribution* —
 * "eight items in Engineering, three of which are also in Security" — rather than spelling out
 * every row. `label` seeds both the id and the display name so rows stay stable and legible.
 */
function itemsIn(
  label: string,
  count: number,
  fixture: Omit<CipherFixture, "id" | "name">,
): CipherView[] {
  return Array.from({ length: count }, (_, index) =>
    cipher({ ...fixture, id: `${label}-${index}`, name: `${label} ${index + 1}` }),
  );
}

/**
 * A deliberately uneven spread across {@link manyCollections}
 */
const manySharedFolderCiphers = [
  ...itemsIn("Engineering service", 5, {
    organizationId: "org-1",
    collectionIds: ["col-eng"],
    folderId: "folder-1",
  }),
  // Also in Security — Engineering reaches 8, Security gets all 3 of its items from this overlap.
  ...itemsIn("Signing key", 3, {
    organizationId: "org-1",
    collectionIds: ["col-eng", "col-security"],
    type: CipherType.SshKey,
  }),
  ...itemsIn("Ops runbook", 4, {
    organizationId: "org-1",
    collectionIds: ["col-ops"],
    type: CipherType.SecureNote,
    favorite: true,
  }),
  // Also in Infrastructure — Operations reaches 6, Infrastructure 3 (with the item below).
  ...itemsIn("Cluster admin", 2, {
    organizationId: "org-1",
    collectionIds: ["col-ops", "col-infra"],
    folderId: "folder-1",
  }),
  ...itemsIn("Datacenter access", 1, { organizationId: "org-1", collectionIds: ["col-infra"] }),
  ...itemsIn("Design tool", 3, { organizationId: "org-1", collectionIds: ["col-design"] }),
  // Human resources: deliberately empty, so its option shows a 0.
  ...itemsIn("Campaign account", 6, {
    organizationId: "org-2",
    collectionIds: ["col-marketing"],
    folderId: "folder-2",
  }),
  ...itemsIn("CRM seat", 2, { organizationId: "org-2", collectionIds: ["col-sales"] }),
  // Also in Sales — Sales reaches 4, Support gets both of its items here.
  ...itemsIn("Helpdesk login", 2, {
    organizationId: "org-2",
    collectionIds: ["col-support", "col-sales"],
    favorite: true,
  }),
  ...itemsIn("Corporate card", 1, {
    organizationId: "org-2",
    collectionIds: ["col-finance"],
    type: CipherType.Card,
  }),
  // Legal: also deliberately empty.
  ...itemsIn("Workstation", 4, { organizationId: "org-2", collectionIds: ["col-it"] }),
];

/**
 * The same uneven treatment for {@link manyFolders}: Work holds 7, Education and Insurance hold
 * none, and four items sit in no folder at all so the "No folder" option carries a real count too.
 * A few organization-owned items land in the small {@link collections} fixture, so the Vault and
 * Shared folders chips vary alongside it — see {@link ManyFolders}.
 */
const manyFolderCiphers = [
  ...itemsIn("Work login", 7, { folderId: "folder-a" }),
  ...itemsIn("Personal login", 4, { folderId: "folder-b" }),
  ...itemsIn("Bank card", 3, { folderId: "folder-c", type: CipherType.Card }),
  ...itemsIn("Trip booking", 2, { folderId: "folder-d", favorite: true }),
  ...itemsIn("Store account", 1, { folderId: "folder-e" }),
  ...itemsIn("Health portal", 1, { folderId: "folder-f" }),
  // Education and Insurance are deliberately empty, so their options show a 0.
  ...itemsIn("Streaming service", 2, { folderId: "folder-h" }),
  ...itemsIn("Utility account", 3, { folderId: "folder-i", type: CipherType.SecureNote }),
  ...itemsIn("Contract note", 1, { folderId: "folder-k", type: CipherType.SecureNote }),
  ...itemsIn("Subscription", 5, { folderId: "folder-l" }),
  // Unfiled, so the "No folder" option has something to count.
  ...itemsIn("Unfiled login", 2, {}),
  ...itemsIn("Shared unfiled", 2, { organizationId: "org-1", collectionIds: ["col-1", "col-2"] }),
];

/**
 * A vault with real items, none favorited and no folders defined — see {@link NoFavoritesOrFolders}.
 * Distinct from {@link Empty}'s `ciphers: []`, which disables the Favorites chip only incidentally
 * because there's no data at all.
 */
const noFavoritesOrFoldersCiphers = [
  {
    id: "1",
    name: "Acme",
    username: "d.finnegan@acme.com",
    password: "pw",
    uri: "https://acme.com",
  },
  {
    id: "2",
    name: "Amazon",
    username: "d.finnegan@acme.com",
    password: "pw",
    uri: "https://amazon.com",
    organizationId: "org-1",
    collectionIds: ["col-1"],
  },
  { id: "3", name: "Apple ID", username: "derekfinnegan@gmail.com", password: "pw" },
].map(cipher);

/** Only Login, Card, and Secure note are present — see {@link NarrowedCipherTypes}. */
const narrowedCipherTypesCiphers = [
  {
    id: "1",
    name: "Amazon",
    username: "derekfinnegan@gmail.com",
    password: "pw",
    uri: "https://amazon.com",
  },
  { id: "2", name: "Chase Bank", type: CipherType.Card },
  { id: "3", name: "Personal notes", type: CipherType.SecureNote },
].map(cipher);

/**
 * Two collections in one organization, with the sole item filed under "Operations" only — so
 * "Engineering" carries a faceted count of 0. See {@link FilteredToZeroByChip}.
 */
const chipFilterZeroCollections = [
  { id: "col-1", name: "Operations" },
  { id: "col-2", name: "Engineering" },
] as CollectionView[];

const chipFilterZeroCiphers = [
  cipher({ id: "1", name: "Acme", organizationId: "org-1", collectionIds: ["col-1"] }),
];

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
              favoritesFilterTooltip: "Mark items as favorites to filter them here.",
              vault: "Vault",
              myVault: "My vault",
              sharedFolders: "Shared folders",
              myFolders: "My folders",
              foldersFilterTooltip: "Add folders to items to filter them here.",
              noneFolder: "No folder",
              noSharedFolder: "No shared folder",
              filterByName: (name) => `Filter by ${name}`,
              itemCount: (count) => `${count} items`,
              filter: "Filter",
              filters: "Filters",
              done: "Done",
              clearAll: "Clear all",
              filtersSelected: (count) => `${count} selected`,
              // Labels a chip's dismiss button, which only renders once the chip is active — so a
              // missing key here throws from `I18nMockService.t` the first time a filter is
              // selected, not on initial render.
              removeItem: (name) => `Remove ${name}`,
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
              clear: "Clear",
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
 * beside the overflow menu. Activating a Shared folders or My folders chip narrows the matching
 * toolbar filter to that folder; the `+N` overflow chip only names what it stands for.
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

/** Template variant that also seeds the chips through `[initialFilterValues]`. */
const initialFilterValuesTemplate = template.replace(
  '[ciphers]="ciphers"',
  '[ciphers]="ciphers" [initialFilterValues]="initialFilterValues"',
);

/**
 * Reaches the same filtered-to-zero empty state as {@link FilteredToZero}, but via a chip rather
 * than search — so, unlike that story, the empty state's Clear all button shows (it's deliberately
 * hidden when search alone is responsible for zero rows).
 *
 * The chip selection is seeded declaratively with `[initialFilterValues]` rather than by simulating
 * clicks: "Engineering" holds no items (the only one is in "Operations"), so the table opens
 * already filtered to zero. Click Clear all to bring the row back.
 */
export const FilteredToZeroByChip: Story = {
  render: () => ({
    props: {
      ...baseProps,
      collections: chipFilterZeroCollections,
      ciphers: chipFilterZeroCiphers,
      initialFilterValues: { sharedFolder: ["col-2"] },
    },
    template: initialFilterValuesTemplate,
  }),
};

/**
 * A vault that genuinely has items — none favorited, and no folders defined at all. Hover the
 * Favorites chip and the My folders chip to see each one's disabled tooltip.
 */
export const NoFavoritesOrFolders: Story = {
  render: () => ({
    props: {
      ...baseProps,
      ciphers: noFavoritesOrFoldersCiphers,
      folders: [],
    },
    template,
  }),
};

/**
 * Only three cipher types are present in the data — Login, Card, and Secure note — so the Type
 * chip's menu offers exactly those three. Open it: Identity, SSH key, Bank account, Driver's
 * license, and Passport are absent, even though the default `cipherTypes` includes them all.
 */
export const NarrowedCipherTypes: Story = {
  render: () => ({
    props: {
      ...baseProps,
      ciphers: narrowedCipherTypesCiphers,
    },
    template,
  }),
};

/**
 * 12 collections spread across the two organizations push the Shared folders chip's option count
 * past `bit-filter-menu`'s in-menu search threshold. Open the chip to see the search box, plus
 * one collapsible `bit-filter-section` per organization (Acme corporation, Contoso) rather than a
 * flat list.
 *
 * The counts are deliberately uneven (Engineering 8, Human resources 0) and the section berries
 * show each organization's selected total. Because several items belong to two collections, the
 * option counts sum to more than the row count. Select one option and watch the others recompute:
 * they're faceted against the *remaining* filters, not fixed totals.
 */
export const ManySharedFolders: Story = {
  render: () => ({
    props: {
      ...baseProps,
      collections: manyCollections,
      ciphers: manySharedFolderCiphers,
    },
    template,
  }),
};

/**
 * 12 folders push the My folders chip's option count past the same threshold. Folders have no
 * owning organization, so — unlike {@link ManySharedFolders} — the chip stays a flat list; open it
 * to see just the search box appear, with no section headers.
 *
 * Counts range from 7 (Work) down to 0 (Education, Insurance), and "No folder" carries its own
 * count from the unfiled items — the case a per-folder tally would miss.
 */
export const ManyFolders: Story = {
  render: () => ({
    props: {
      ...baseProps,
      folders: manyFolders,
      ciphers: manyFolderCiphers,
    },
    template,
  }),
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
