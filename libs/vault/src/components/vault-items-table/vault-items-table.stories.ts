import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { SearchService as DefaultSearchService } from "@bitwarden/common/vault/services/search.service";
import { ButtonModule, I18nMockService, TypographyModule } from "@bitwarden/components";
import { ConsoleLogService } from "@bitwarden/logging";

import { CopyCipherFieldService } from "../../services/copy-cipher-field.service";

import {
  DEFAULT_COPY_PRESENTATION,
  VaultItemsTableCopyPresentation,
} from "./vault-items-table-copy-presentation";
import { VaultItemsTableRowAction } from "./vault-items-table-row-action";
import { VaultItemsTableComponent, VaultItemsTableFilters } from "./vault-items-table.component";

const organizations = [
  { id: "org-1", name: "Acme corporation" },
  { id: "org-2", name: "Contoso" },
] as Organization[];

/**
 * Three collections that hold items, plus one that deliberately holds none — "Human resources"
 * carries a faceted count of 0 wherever the Shared folders chip appears, and gives
 * {@link FilteredToZeroByChip} a selection that excludes every row.
 */
const collections = [
  { id: "col-1", name: "Operations" },
  { id: "col-2", name: "Engineering" },
  { id: "col-3", name: "Finance" },
  { id: "col-4", name: "Human resources" },
] as CollectionView[];

const folders = [
  { id: "folder-1", name: "Work" },
  { id: "folder-2", name: "Finance" },
] as FolderView[];

/**
 * 12 collections split across the two organizations above the `SEARCH_THRESHOLD`
 * `bit-filter-menu` uses to show its in-menu search (10, exclusive) — see {@link ManyFilterOptions}.
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

/** 12 folders, above the same threshold — see {@link ManyFilterOptions}. */
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
 * A deliberately uneven spread across both {@link manyCollections} and {@link manyFolders}, so one
 * dataset pushes the Shared folders chip *and* the My folders chip past the search threshold — see
 * {@link ManyFilterOptions}.
 *
 * Collection counts run from 8 (Engineering) down to 0 (Human resources, Legal), and because
 * several items belong to two collections they sum to more than the row count. Folder counts run
 * from 8 (Work, Personal) down to 0 (Education, Insurance), with six rows left unfiled so the
 * "No folder" option carries a count of its own. The trailing individual-vault items can't belong
 * to a shared folder, so they exercise the folder chip on rows the Shared folders column leaves
 * blank.
 */
const manyFilterOptionCiphers = [
  ...itemsIn("Engineering service", 5, {
    organizationId: "org-1",
    collectionIds: ["col-eng"],
    folderId: "folder-a",
  }),
  // Also in Security — Engineering reaches 8, Security gets all 3 of its items from this overlap.
  ...itemsIn("Signing key", 3, {
    organizationId: "org-1",
    collectionIds: ["col-eng", "col-security"],
    type: CipherType.SshKey,
    folderId: "folder-a",
  }),
  ...itemsIn("Ops runbook", 4, {
    organizationId: "org-1",
    collectionIds: ["col-ops"],
    type: CipherType.SecureNote,
    favorite: true,
    folderId: "folder-b",
  }),
  // Also in Infrastructure — Operations reaches 6, Infrastructure 3 (with the item below).
  ...itemsIn("Cluster admin", 2, {
    organizationId: "org-1",
    collectionIds: ["col-ops", "col-infra"],
    folderId: "folder-i",
  }),
  ...itemsIn("Datacenter access", 1, {
    organizationId: "org-1",
    collectionIds: ["col-infra"],
    folderId: "folder-i",
  }),
  ...itemsIn("Design tool", 3, {
    organizationId: "org-1",
    collectionIds: ["col-design"],
    folderId: "folder-h",
  }),
  // Human resources: deliberately empty, so its option shows a 0.
  ...itemsIn("Campaign account", 6, {
    organizationId: "org-2",
    collectionIds: ["col-marketing"],
    folderId: "folder-l",
  }),
  ...itemsIn("CRM seat", 2, {
    organizationId: "org-2",
    collectionIds: ["col-sales"],
    folderId: "folder-c",
  }),
  // Also in Sales — Sales reaches 4, Support gets both of its items here.
  ...itemsIn("Helpdesk login", 2, {
    organizationId: "org-2",
    collectionIds: ["col-support", "col-sales"],
    favorite: true,
    folderId: "folder-c",
  }),
  ...itemsIn("Corporate card", 1, {
    organizationId: "org-2",
    collectionIds: ["col-finance"],
    type: CipherType.Card,
    folderId: "folder-f",
  }),
  // Legal: also deliberately empty. Unfiled too, so "No folder" has something to count.
  ...itemsIn("Workstation", 4, { organizationId: "org-2", collectionIds: ["col-it"] }),
  // Individual-vault items from here down — Personal reaches 8 alongside the runbooks above.
  ...itemsIn("Personal login", 4, { folderId: "folder-b" }),
  ...itemsIn("Trip booking", 2, { folderId: "folder-d", favorite: true }),
  ...itemsIn("Store account", 1, { folderId: "folder-e" }),
  ...itemsIn("Contract note", 1, { folderId: "folder-k", type: CipherType.SecureNote }),
  ...itemsIn("Unfiled login", 2, {}),
];

/** Web's overflow set, in the order the cipher row menu lists it. */
const rowActions: VaultItemsTableRowAction<CipherView>[] = [
  {
    id: "favorite",
    label: "Favorite",
    icon: "bwi-star",
    show: (item) => !item.favorite,
    run: () => {},
  },
  {
    id: "unfavorite",
    label: "Unfavorite",
    icon: "bwi-star",
    show: (item) => item.favorite,
    run: () => {},
  },
  { id: "edit", label: "Edit", icon: "bwi-pencil-square", run: () => {} },
  { id: "attachments", label: "Attachments", icon: "bwi-paperclip", run: () => {} },
  { id: "clone", label: "Clone", icon: "bwi-files", run: () => {} },
  {
    id: "assign-to-collections",
    label: "Assign to collections",
    icon: "bwi-collection-shared",
    run: () => {},
  },
  {
    id: "events",
    label: "Event logs",
    icon: "bwi-file-text",
    show: (item) => item.organizationId != null,
    run: () => {},
  },
  {
    id: "archive",
    label: "Archive",
    icon: "bwi-archive",
    // Archive is a premium feature, so a free user gets the Upgrade badge rather than the action.
    premiumGated: () => true,
    run: () => {},
  },
  {
    id: "delete",
    label: "Delete",
    icon: "bwi-trash",
    variant: "danger",
    run: () => {},
  },
];

/**
 * Every prop the shared template binds. The table's own inputs, plus `heading` for the stories that
 * title the page above it — see {@link template}.
 */
type StoryProps = {
  ciphers: CipherView[];
  scopedOrganizationId?: OrganizationId;
  orgRequiresDataOwnership: boolean;
  loading: boolean;
  rowActions: VaultItemsTableRowAction<CipherView>[];
  folders: FolderView[];
  collections: CollectionView[];
  organizations: Organization[];
  copyPresentation: VaultItemsTableCopyPresentation;
  initialFilterValues?: Partial<VaultItemsTableFilters>;
  heading?: string;
  itemAction: (item: CipherView) => void;
};

/**
 * One template for every story: it binds all of the table's optional inputs unconditionally and
 * leaves the defaults to {@link baseProps}, so a story only ever overrides `args`. The heading is
 * how a host titles the page when its side nav has scoped the vault — see {@link ScopedToMyVault}.
 */
const template = `
  @if (heading) {
    <h1 bitTypography="h1">{{ heading }}</h1>
  }
  <div style="display:flex; min-height: 600px;">
    <vault-items-table
      [ciphers]="ciphers"
      [scopedOrganizationId]="scopedOrganizationId"
      [orgRequiresDataOwnership]="orgRequiresDataOwnership"
      [loading]="loading"
      [rowActions]="rowActions"
      [folders]="folders"
      [collections]="collections"
      [organizations]="organizations"
      [copyPresentation]="copyPresentation"
      [initialFilterValues]="initialFilterValues"
      [itemAction]="itemAction"
    >
      <button slot="toolbar" bitButton buttonType="secondary" type="button" startIcon="bwi-import">
        Import
      </button>
      <button slot="toolbar" bitButton buttonType="primary" type="button" startIcon="bwi-plus">
        Add
      </button>
    </vault-items-table>
  </div>
`;

const baseProps: StoryProps = {
  ciphers,
  loading: false,
  orgRequiresDataOwnership: false,
  rowActions,
  folders,
  collections,
  organizations,
  copyPresentation: DEFAULT_COPY_PRESENTATION,
  itemAction: () => {},
};

export default {
  title: "Vault/Vault Items Table",
  component: VaultItemsTableComponent,
  render: (args) => ({ props: args, template }),
  args: baseProps,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, TypographyModule],
      providers: [
        {
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
              // Chip group overflow, for the membership columns
              showMore: "Show more",
              showMoreCount: (count) => `Show ${count} more`,
              itemCount: (count) => `${count} items`,
              filter: "Filter",
              filters: "Filters",
              done: "Done",
              clearAll: "Clear all",
              filtersSelected: (count) => `${count} selected`,
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
              launchWebsite: "Launch website",
              selectAllRows: "Select all rows",
              selectRow: "Select row",
              // Premium-gated row actions
              upgrade: "Upgrade",
              upgradeToPremium: "Upgrade to premium",
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
              copyPrivateKey: "Copy private key",
              copyPublicKey: "Copy public key",
              copyFingerprint: "Copy fingerprint",
              copyNoteTitle: (name) => `Copy Note - ${name}`,
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
          provide: AvatarService,
          useValue: { getUserAvatarColor$: () => of("#175ddc") },
        },
        // The real search service, so the search box behaves here exactly as it does in a client —
        // including `>`-prefixed lunr queries. It's built directly rather than injected so it can
        // be handed a `locale$`, which `I18nMockService` doesn't implement.
        {
          provide: SearchService,
          useFactory: () =>
            new DefaultSearchService(
              new ConsoleLogService(true) as unknown as LogService,
              {
                locale$: of("en"),
              } as I18nService,
            ),
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
        // A free user, so the premium-gated Archive action shows its Upgrade badge.
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: () => of(false) },
        },
        {
          provide: PremiumUpgradePromptService,
          useValue: { promptForPremium: () => action("PremiumUpgradePrompt") },
        },
      ],
    }),
  ],
} as Meta<StoryProps>;

type Story = StoryObj<StoryProps>;

/**
 * The table as a host gets it out of the box: bind `ciphers`, `folders`, `collections`, and
 * `organizations`, and the chips, columns, and counts follow from the rows.
 *
 * Hover or keyboard-focus a row to reveal the Launch and Copy quick actions beside the overflow
 * menu. Clicking a Shared folders or My folders chip inside a row narrows the matching toolbar
 * filter to that folder; where a row has more than one, a `+N` chip stands in for the rest and
 * names them on hover.
 */
export const Default: Story = {};

/** Bind `loading` while the vault decrypts and skeleton rows stand in for the data. */
export const Loading: Story = {
  args: { loading: true },
};

/**
 * An empty `ciphers` array. The copy invites the user to add their first item, which is why this
 * state is worth distinguishing from [Filtered To Zero](#filtered-to-zero) — there, the fix is to
 * clear a filter rather than to add anything.
 *
 * `organizations` and `collections` are cleared so the Vault and Shared folders chips don't appear
 * when there is nothing in the vault — a new user has no org context yet.
 */
export const Empty: Story = {
  args: { ciphers: [], organizations: [], collections: [] },
};

/**
 * There are rows, but nothing survives the active search. `initialFilterValues` seeds the reserved
 * `search` key here, the same way the story below seeds a chip — clear the search box to bring the
 * rows back.
 *
 * The empty state offers no Clear all button: clearing the chips wouldn't bring the rows back while
 * the search term still excludes them. Compare
 * [Filtered To Zero By Chip](#filtered-to-zero-by-chip), where it does.
 */
export const FilteredToZero: Story = {
  args: { initialFilterValues: { search: "no-such-item" } },
};

/**
 * Use `initialFilterValues` to open the table with chips already applied — deep-linking into a
 * single shared folder. It's read once per chip as that chip registers, so later changes are
 * ignored; to drive chips reactively, reach for the underlying table's filter controls instead.
 *
 * Here it selects a shared folder that holds no items, so the table opens filtered to zero. Because
 * a chip is responsible, the empty state offers Clear all — click it to bring the rows back.
 */
export const FilteredToZeroByChip: Story = {
  args: { initialFilterValues: { sharedFolder: ["col-4"] } },
};

/**
 * What the toolbar does when a filter has nothing to offer. Supply an empty `folders` array, or rows
 * with nothing favorited, and the matching chip is disabled with a tooltip explaining how to make it
 * useful — hover Favorites and My folders to see both.
 *
 * A row whose folder isn't in `folders` renders no chip rather than a nameless one, so a host can
 * narrow `folders` without scrubbing the rows to match.
 */
export const NoFavoritesOrFolders: Story = {
  args: {
    ciphers: ciphers.filter((cipher) => !cipher.favorite),
    folders: [],
  },
};

/**
 * The Type chip offers only the types present in the rows, so a host never has to prune it. Narrow
 * the rows to logins and it comes down to a single option — the other seven are absent even though
 * the table's default `cipherTypes` includes them all.
 *
 * Bind `cipherTypes` to narrow it further than the data would, which is how a client keeps a type
 * behind a feature flag.
 */
export const NarrowedCipherTypes: Story = {
  args: { ciphers: ciphers.filter((cipher) => cipher.type === CipherType.Login) },
};

/**
 * How the folder chips hold up at scale, with more than ten options in each.
 *
 * Open Shared folders: past that many options a chip grows an in-menu search box, and this one also
 * groups into a collapsible section per organization, each with a berry showing how many of its
 * options are selected. Open My folders for the contrast — folders have no owning organization, so
 * it gains the search box but stays a flat list.
 *
 * Every option carries a count faceted against the *remaining* filters rather than a fixed total, so
 * selecting one option recomputes the others. Counts can therefore sum to more than the row count,
 * since an item may sit in two shared folders, and "No folder" counts the unfiled rows.
 */
export const ManyFilterOptions: Story = {
  args: {
    collections: manyCollections,
    folders: manyFolders,
    ciphers: manyFilterOptionCiphers,
  },
};

/**
 * Scoping the table to one vault takes nothing but a narrower `ciphers` and an empty
 * `organizations` array — the table works the rest out from those two inputs.
 *
 * With no organizations provided, the Vault chip and column drop out, and so do Shared folders,
 * since an individually-owned item can't belong to one. Render the page heading yourself: once the
 * Vault column is gone, it's what tells the user where they are.
 */
export const ScopedToMyVault: Story = {
  args: {
    heading: "My vault",
    ciphers: ciphers.filter((cipher) => !cipher.organizationId),
    organizations: [],
    collections: [],
  },
};

/**
 * The same scoping to a single organization — see [Scoped To My Vault](#scoped-to-my-vault).
 * Shared folders stays useful here, since the rows still spread across that organization's
 * collections.
 *
 * Passing only the scoped organization drops the Vault chip and column: a single org with no
 * personal-vault option (suppressed by `scopedOrganizationId`) leaves nothing to distinguish
 * between. `scopedOrganizationId` also scopes the search service's lunr index to this org.
 */
export const ScopedToOrganizationVault: Story = {
  args: {
    heading: "Acme corporation's vault",
    ciphers: ciphers.filter((cipher) => cipher.organizationId === "org-1"),
    organizations: [organizations[0]],
    scopedOrganizationId: "org-1" as OrganizationId,
  },
};

/**
 * Bind `copyPresentation` as `"expanded"` to give each copyable field its own button — username,
 * password, and TOTP for a login — rather than one Copy button that opens a menu. Hover a row to
 * compare with [Default](#default).
 */
export const ExpandedCopyActions: Story = {
  args: { copyPresentation: "expanded" },
};
