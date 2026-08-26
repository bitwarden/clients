import { computed, signal } from "@angular/core";
import { Router } from "@angular/router";
import { applicationConfig, Meta, StoryObj } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CompactModeService,
  DialogService,
  I18nMockService,
  ToastService,
} from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import { MY_VAULT, PasswordRepromptService, VaultCopyButtonsService } from "@bitwarden/vault";

import { PopupWidthOptions } from "../../../../../platform/browser/browser-popup-utils";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
import { VaultPopupListTableFiltersService } from "../../../services/vault-popup-list-table-filters.service";
import { VaultSection } from "../../../services/vault-popup-list-table.service";
import { VaultPopupLoadingService } from "../../../services/vault-popup-loading.service";
import { VaultPopupSectionService } from "../../../services/vault-popup-section.service";
import { PopupCipherViewLike } from "../../../views/popup-cipher.view";

import { VaultPopupListTableComponent } from "./vault-popup-list-table.component";

// Real `CipherView` instances rather than hand-mocked shapes: the row reads derived values (e.g. the
// `subTitle` getter that surfaces a login's username) straight off the model, so building the actual
// class is both simpler than mocking every getter and a truer exercise of the component.

// Fixtures must be deterministic: Storybook snapshots these stories in Chromatic on every PR, so any
// randomness here would diff against its baseline every build and erode the visual-regression signal.
// `pick` rotates through each list in a fixed order — its own cursor per array — so fixtures keep
// their variety without randomness.
const pickCursors = new WeakMap<readonly unknown[], number>();
const pick = <T>(items: readonly T[]): T => {
  const next = pickCursors.get(items) ?? 0;
  pickCursors.set(items, next + 1);
  return items[next % items.length];
};
const sequentialDigits = (length: number): string =>
  Array.from({ length }, (_, i) => String((i + 1) % 10)).join("");

const WEBSITES = [
  { name: "GitHub", uri: "https://github.com" },
  { name: "Google", uri: "https://accounts.google.com" },
  { name: "Bitwarden", uri: "https://vault.bitwarden.com" },
  { name: "Amazon", uri: "https://amazon.com" },
  { name: "Netflix", uri: "https://netflix.com" },
  { name: "Spotify", uri: "https://open.spotify.com" },
  { name: "Reddit", uri: "https://reddit.com" },
  { name: "Dropbox", uri: "https://dropbox.com" },
  { name: "Steam", uri: "https://store.steampowered.com" },
  { name: "Figma", uri: "https://figma.com" },
] as const;
const FIRST_NAMES = [
  "Alex",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Jamie",
  "Quinn",
] as const;
const LAST_NAMES = [
  "Rivera",
  "Chen",
  "Patel",
  "Okafor",
  "Nguyen",
  "Silva",
  "Haddad",
  "Kim",
] as const;
const EMAIL_DOMAINS = ["gmail.com", "proton.me", "outlook.com", "fastmail.com"] as const;
const CARD_BRANDS = ["Visa", "Mastercard", "American Express", "Discover"] as const;

const makeEmail = (first = pick(FIRST_NAMES), last = pick(LAST_NAMES)): string =>
  `${first}.${last}@${pick(EMAIL_DOMAINS)}`.toLowerCase();

/** A real `CipherView` with a random id, editable and viewable by default. */
const baseCipher = (type: CipherType, name: string): CipherView => {
  const cipher = new CipherView();
  cipher.id = crypto.randomUUID();
  cipher.type = type;
  cipher.name = name;
  cipher.edit = true;
  cipher.viewPassword = true;
  return cipher;
};

const makeLogin = (
  overrides: { name?: string; username?: string; favorite?: boolean } = {},
): CipherView => {
  const site = pick(WEBSITES);
  const cipher = baseCipher(CipherType.Login, overrides.name ?? site.name);
  cipher.favorite = overrides.favorite ?? false;
  // `"username" in overrides` distinguishes "no override" (default email) from an explicit
  // `undefined` (a password-only login, whose subtitle is intentionally blank).
  cipher.login.username = "username" in overrides ? overrides.username : makeEmail();
  const uri = new LoginUriView();
  uri.uri = site.uri;
  cipher.login.uris = [uri];
  return cipher;
};

const makeCard = (): CipherView => {
  const brand = pick(CARD_BRANDS);
  const cipher = baseCipher(CipherType.Card, `${brand} card`);
  cipher.card.brand = brand;
  cipher.card.number = sequentialDigits(16);
  cipher.card.expMonth = "8";
  cipher.card.expYear = "2030";
  return cipher;
};

const makeIdentity = (): CipherView => {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const cipher = baseCipher(CipherType.Identity, `${first} ${last}`);
  cipher.identity.firstName = first;
  cipher.identity.lastName = last;
  cipher.identity.email = makeEmail(first, last);
  return cipher;
};

/** Give the cipher a single attachment so the paperclip icon renders. */
const withAttachment = (cipher: CipherView): CipherView => {
  cipher.attachments = [new AttachmentView()];
  return cipher;
};

/** Tag a cipher as organization-owned and attach the popup's org/collection decorations. */
const inOrganization = (
  cipher: CipherView,
  productTierType: ProductTierType,
  collectionNames: string[],
): PopupCipherViewLike => {
  const organizationId = crypto.randomUUID() as OrganizationId;
  cipher.organizationId = organizationId;
  cipher.collectionIds = collectionNames.map(() => crypto.randomUUID());

  const organization = new Organization();
  organization.id = organizationId;
  organization.productTierType = productTierType;

  const collections = collectionNames.map(
    (name, i) =>
      new CollectionView({ id: cipher.collectionIds[i] as CollectionId, organizationId, name }),
  );

  return Object.assign(cipher, { organization, collections }) as PopupCipherViewLike;
};

const AUTOFILL_CIPHERS: PopupCipherViewLike[] = [
  makeLogin(),
  makeLogin(),
  // No username, so its accessible title omits the field (`autofillTitle` vs `autofillTitleWithField`)
  // and its subtitle is blank. The logins above exercise the `*WithField` variants.
  makeLogin({ name: "Password-only Login", username: undefined }),
  // A card and identity so the autofill section's type subgroups (Card / Identity) render.
  makeCard(),
  makeIdentity(),
];

const FAVORITE_CIPHERS: PopupCipherViewLike[] = [makeLogin({ favorite: true })];

const ALL_ITEM_CIPHERS: PopupCipherViewLike[] = [
  makeLogin(),
  makeLogin(),
  makeCard(),
  makeIdentity(),
  // Has an attachment, so the paperclip icon renders with its `attachments` accessible title.
  withAttachment(makeLogin()),
  // In an organization across multiple shared folders: the org icon tooltip reads `nSharedFolders`.
  inOrganization(makeLogin(), ProductTierType.Enterprise, ["Engineering", "Marketing"]),
  // In an organization within a single shared folder: the org icon tooltip reads that folder's name.
  inOrganization(makeLogin(), ProductTierType.Families, ["Engineering"]),
];

type StoryArgs = {
  autoFillCiphers: PopupCipherViewLike[];
  favoriteCiphers: PopupCipherViewLike[];
  filteredCiphers: PopupCipherViewLike[];
  loading: boolean;
  /** When true, the current tab is blocklisted: autofill is disabled and the section is retitled. */
  currentUriIsBlocked?: boolean;
  /** When true, render as if in the sidebar so the autofill section shows the refresh control. */
  inSidebar?: boolean;
  /** PM31039ItemActionInExtension flag. Defaults to on (the simplified item-action design). */
  simplifiedItemActionEnabled?: boolean;
  /** Legacy (flag-off) setting: whether clicking an autofill suggestion fills it. Defaults to on. */
  clickItemsToAutofillVaultView?: boolean;
  /** Filters to restore into the chips on story load — ids, matching what `restoreFilters$` emits. */
  appliedFilters?: {
    cipherType?: CipherType | null;
    organization?: string[];
    collection?: string[];
    folder?: string[];
  };
  /** Sections rendered collapsed. Defaults to all expanded. */
  collapsedSections?: VaultSection[];
};

// Option sets for the toolbar's filter chips. A chip only renders when its stream has entries, so
// these also control which chips appear.
const ORGANIZATION_OPTIONS = [
  { value: { id: MY_VAULT } as Organization, label: "My vault", icon: "bwi-user" as const },
  {
    value: { id: "org-engineering" } as Organization,
    label: "Acme Co",
    icon: "bwi-business" as const,
  },
];

const COLLECTION_OPTIONS = [
  { value: { id: "col-eng", name: "Engineering" } as CollectionView, label: "Engineering" },
  { value: { id: "col-mkt", name: "Marketing" } as CollectionView, label: "Marketing" },
];

// Nested to exercise the tree flattening: the child renders as its own option, labeled with only
// its trailing segment.
const FOLDER_OPTIONS = [
  {
    value: { id: "folder-work", name: "Work" } as FolderView,
    label: "Work",
    children: [{ value: { id: "folder-work-eu", name: "Work/EU" } as FolderView, label: "EU" }],
  },
  { value: { id: "folder-personal", name: "Personal" } as FolderView, label: "Personal" },
];

const CIPHER_TYPE_OPTIONS = [
  { value: CipherType.Login, label: "Login" },
  { value: CipherType.Card, label: "Card" },
  { value: CipherType.Identity, label: "Identity" },
  { value: CipherType.SecureNote, label: "Note" },
];

const buildProviders = (args: StoryArgs) => {
  const autoFillCiphers$ = new BehaviorSubject(args.autoFillCiphers);
  const favoriteCiphers$ = new BehaviorSubject(args.favoriteCiphers);
  const loading$ = new BehaviorSubject(args.loading);

  // The all-items list narrows as the user searches; keep the unfiltered set to search against.
  const allItems = args.filteredCiphers;
  const filteredCiphers$ = new BehaviorSubject(allItems);
  const searchText$ = new BehaviorSubject("");
  const hasSearchText$ = new BehaviorSubject(false);

  // Minimal stand-in for the real search service so the toolbar search folds the list live.
  const applyFilter = (text: string) => {
    const term = (text ?? "").trim().toLowerCase();
    searchText$.next(text ?? "");
    hasSearchText$.next(term.length > 0);
    filteredCiphers$.next(
      term ? allItems.filter((c) => c.name.toLowerCase().includes(term)) : allItems,
    );
  };

  // `showRefresh` reads `BrowserPopupUtils.inSidebar(window)`, which checks the window URL for
  // `uilocation=sidebar`. Provide a fake `WINDOW` per story so the refresh control is controlled by
  // injection (isolated per story, including on the docs page) rather than by mutating a global.
  const fakeWindow = {
    location: {
      href: args.inSidebar ? "https://example.com/?uilocation=sidebar" : "https://example.com/",
    },
  } as Window;

  // A signal, matching the real service's return type, so a section header toggle re-renders.
  const collapsedSections = signal(new Set(args.collapsedSections ?? []));

  return [
    { provide: WINDOW, useValue: fakeWindow },
    {
      provide: VaultPopupListTableFiltersService,
      useValue: {
        restoreFilters$: () => of(args.appliedFilters ?? {}),
        saveFilters: () => {},
        selectedOrganizations: signal<string[]>([]),
        cipherTypes$: of(CIPHER_TYPE_OPTIONS),
        organizations$: of(ORGANIZATION_OPTIONS),
        collections$: of(COLLECTION_OPTIONS),
        folders$: of(FOLDER_OPTIONS),
      },
    },
    {
      provide: VaultPopupItemsService,
      useValue: {
        autoFillCiphers$: autoFillCiphers$.asObservable(),
        favoriteCiphers$: favoriteCiphers$.asObservable(),
        filteredCiphers$: filteredCiphers$.asObservable(),
        loading$: loading$.asObservable(),
        searchText$: searchText$.asObservable(),
        hasSearchText$: hasSearchText$.asObservable(),
        // No story exercises the suspended-organization notice.
        showDeactivatedOrg$: of(false),
        applyFilter,
      },
    },
    {
      provide: VaultPopupLoadingService,
      useValue: { loading$: loading$.asObservable() },
    },
    {
      provide: VaultPopupAutofillService,
      useValue: {
        currentTabIsOnBlocklist$: of(args.currentUriIsBlocked ?? false),
        autofillAllowed$: of(false),
        currentAutofillTab$: of(null),
        doAutofill: async () => {},
      },
    },
    {
      provide: VaultPopupSectionService,
      useValue: {
        getOpenDisplayStateForSection: (section: VaultSection) =>
          computed(() => !collapsedSections().has(section)),
        // Persisted for real by the section service; here it just keeps the story interactive.
        updateSectionOpenStoredState: async (section: VaultSection, open: boolean) => {
          collapsedSections.update((sections) => {
            const next = new Set(sections);
            if (open) {
              next.delete(section);
            } else {
              next.add(section);
            }
            return next;
          });
        },
      },
    },
    {
      provide: CompactModeService,
      useValue: { enabled$: of(false) },
    },
    {
      provide: ConfigService,
      useValue: {
        getFeatureFlag$: (flag: FeatureFlag) => {
          if (flag === FeatureFlag.PM31039ItemActionInExtension) {
            return of(args.simplifiedItemActionEnabled ?? true);
          }
          return of(false);
        },
      },
    },
    {
      provide: VaultSettingsService,
      useValue: { clickItemsToAutofillVaultView$: of(args.clickItemsToAutofillVaultView ?? true) },
    },
    {
      provide: I18nService,
      useFactory: () =>
        new I18nMockService({
          search: "Search",
          searchResults: "Search results",
          resetSearch: "Reset search",
          name: "Name",
          autofillSuggestions: "Autofill suggestions",
          itemSuggestions: "Suggested items",
          // Sidebar-only autofill refresh control; not rendered in Storybook (not a sidebar).
          refresh: "Refresh",
          favorites: "Favorites",
          allItems: "All items",
          typeLogin: "Login",
          typeCard: "Card",
          typeIdentity: "Identity",
          fill: "Fill",
          // Accessible row titles (appA11yTitle on the row button and attachment icon)
          autofillTitle: "Autofill - __$1__",
          autofillTitleWithField: "Autofill - __$1__ - __$2__",
          viewItemTitle: "View item - __$1__",
          viewItemTitleWithField: "View item - __$1__ - __$2__",
          attachments: "Attachments",
          // Org-icon tooltip (appA11yTitle) for ciphers in multiple shared folders
          nSharedFolders: "__$1__ shared folders",
          noItemsMatchSearch: "No items match your search",
          nothingToShow: "Nothing to show",
          // Copyable-field labels used by app-item-copy-actions
          username: "Username",
          password: "Password",
          verificationCodeTotp: "Verification code (TOTP)",
          securityCode: "Security code",
          cardNumber: "Card number",
          address: "Address",
          email: "Email",
          phone: "Phone",
          copy: "Copy",
          moreOptionsLabelNoPlaceholder: "More options",
          copyFieldCipherName: "Copy __$1__ for __$2__",
          copyInfoTitle: "Copy info for __$1__",
          copyNoteTitle: "Copy note for __$1__",
          noValuesToCopy: "No values to copy",
          copyUsername: "Copy username",
          copyPassword: "Copy password",
          copyVerificationCode: "Copy verification code",
          copyNumber: "Copy number",
          copySecurityCode: "Copy security code",
          copyEmail: "Copy email",
          copyAddress: "Copy address",
          copyPhone: "Copy phone",
          close: "Close",
          // app-item-more-options menu
          autofillVerb: "Autofill",
          view: "View",
          favorite: "Favorite",
          unfavorite: "Unfavorite",
          edit: "Edit",
          clone: "Clone",
          assignToCollections: "Assign to shared folders",
          archiveVerb: "Archive",
          upgradeToUseArchive: "Upgrade to use archive",
          delete: "Delete",
          launchWebsiteForName: "Launch __$1__",
          itemCount: "__$1__ items",
          // Toolbar filter chips (and the responsive filter dialog they collapse into)
          all: "All",
          type: "Type",
          vault: "Vault",
          vaults: "Vaults",
          collection: "Collection",
          sharedFolders: "Shared folders",
          folder: "Folder",
          myFolders: "My folders",
          filter: "Filter",
          filters: "Filters",
          filtersSelected: "__$1__ selected",
          removeItem: "Remove __$1__",
          clear: "Clear",
          clearAll: "Clear all",
          done: "Done",
          back: "Back",
          noMatchingItems: "No matching items",
        }),
    },
    {
      provide: EnvironmentService,
      useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
    },
    {
      // Favicons off so snapshots don't attempt remote favicon fetches during Chromatic builds,
      // which would make the rendered icons non-deterministic (and require network access offline).
      provide: DomainSettingsService,
      useValue: { showFavicons$: of(false) },
    },
    {
      provide: VaultCopyButtonsService,
      useValue: { showQuickCopyActions$: of(false) },
    },
    {
      provide: AccountService,
      useValue: { activeAccount$: of({ id: "story-user-id" }) },
    },
    {
      provide: StateProvider,
      useValue: {
        getUserState$: () => of({ hasSeen: false, hasDismissed: false }),
        getUser: () => ({ update: async () => {} }),
      },
    },
    {
      provide: RestrictedItemTypesService,
      useValue: { restricted$: of([]) },
    },
    { provide: CipherService, useValue: {} },
    { provide: PasswordRepromptService, useValue: {} },
    { provide: ToastService, useValue: {} },
    { provide: DialogService, useValue: {} },
    { provide: OrganizationService, useValue: { hasOrganizations: () => of(false) } },
    {
      provide: CipherAuthorizationService,
      useValue: {
        canDeleteCipher$: () => of(false),
        canCloneCipher$: () => of(false),
      },
    },
    { provide: CollectionService, useValue: { decryptedCollections$: () => of([]) } },
    { provide: CipherArchiveService, useValue: { userCanArchive$: () => of(false) } },
    {
      provide: PlatformUtilsService,
      useValue: { getAutofillKeyboardShortcut: async () => "Ctrl+Shift+L" },
    },
    { provide: EventCollectionService, useValue: {} },
    { provide: TotpService, useValue: {} },
    {
      provide: BillingAccountProfileStateService,
      useValue: { hasPremiumFromAnySource$: () => of(true) },
    },
    { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
  ];
};

export default {
  title: "Browser/Vault/VaultPopupListTable",
  component: VaultPopupListTableComponent,
} as Meta<VaultPopupListTableComponent>;

// `StoryArgs` is the input to `buildProviders`, not Storybook args (data flows through providers,
// not the args table), so the Story type is keyed on the component alone.
type Story = StoryObj<VaultPopupListTableComponent>;

export const Default: Story = {
  decorators: [
    applicationConfig({
      providers: buildProviders({
        autoFillCiphers: AUTOFILL_CIPHERS,
        favoriteCiphers: FAVORITE_CIPHERS,
        // Mirrors the real service: `filteredCiphers$` is the full list, so it also
        // contains the autofill and favorite ciphers that render in their own sections.
        filteredCiphers: [...AUTOFILL_CIPHERS, ...FAVORITE_CIPHERS, ...ALL_ITEM_CIPHERS],
        loading: false,
      }),
    }),
  ],
  render: () => ({
    template: `<div class="tw-flex tw-flex-col" style="height: 500px"><app-vault-popup-list-table></app-vault-popup-list-table></div>`,
  }),
};

export const Loading: Story = {
  decorators: [
    applicationConfig({
      providers: buildProviders({
        autoFillCiphers: [],
        favoriteCiphers: [],
        filteredCiphers: [],
        loading: true,
      }),
    }),
  ],
  render: () => ({
    template: `<div class="tw-flex tw-flex-col" style="height: 500px"><app-vault-popup-list-table></app-vault-popup-list-table></div>`,
  }),
};

export const EmptyVault: Story = {
  decorators: [
    applicationConfig({
      providers: buildProviders({
        autoFillCiphers: [],
        favoriteCiphers: [],
        filteredCiphers: [],
        loading: false,
      }),
    }),
  ],
  render: () => ({
    template: `<div class="tw-flex tw-flex-col" style="height: 500px"><app-vault-popup-list-table></app-vault-popup-list-table></div>`,
  }),
};

// Rendered as if in the sidebar (`inSidebar: true` provides a fake window whose URL carries
// `uilocation=sidebar`): the autofill section header shows the refresh button. The injected window
// scopes this to this story alone, so the control never leaks into the others on the docs page.
export const SidebarRefresh: Story = {
  decorators: [
    applicationConfig({
      providers: buildProviders({
        autoFillCiphers: AUTOFILL_CIPHERS,
        favoriteCiphers: FAVORITE_CIPHERS,
        filteredCiphers: [...AUTOFILL_CIPHERS, ...FAVORITE_CIPHERS, ...ALL_ITEM_CIPHERS],
        loading: false,
        inSidebar: true,
      }),
    }),
  ],
  render: () => ({
    template: `<div class="tw-flex tw-flex-col" style="height: 500px"><app-vault-popup-list-table></app-vault-popup-list-table></div>`,
  }),
};

// Legacy (PM31039ItemActionInExtension off) affordance: autofill suggestions show a primary "Fill"
// chip (with a keyboard-shortcut tooltip) instead of fill-on-click. `clickItemsToAutofillVaultView`
// is off so the chip is shown rather than the click itself autofilling.
export const LegacyAutofillButton: Story = {
  decorators: [
    applicationConfig({
      providers: buildProviders({
        autoFillCiphers: AUTOFILL_CIPHERS,
        favoriteCiphers: FAVORITE_CIPHERS,
        filteredCiphers: [...AUTOFILL_CIPHERS, ...FAVORITE_CIPHERS, ...ALL_ITEM_CIPHERS],
        loading: false,
        simplifiedItemActionEnabled: false,
        clickItemsToAutofillVaultView: false,
      }),
    }),
  ],
  render: () => ({
    template: `<div class="tw-flex tw-flex-col" style="height: 500px"><app-vault-popup-list-table></app-vault-popup-list-table></div>`,
  }),
};

// Filters pre-applied to `filterForm`: Type and Vault render active with their selection in the
// chip label, while multi-select My folders shows a count berry. Narrow the viewport to see the
// chip row collapse into the sliders trigger.
export const ActiveFilters: Story = {
  decorators: [
    applicationConfig({
      providers: buildProviders({
        autoFillCiphers: AUTOFILL_CIPHERS,
        favoriteCiphers: FAVORITE_CIPHERS,
        filteredCiphers: [...AUTOFILL_CIPHERS, ...FAVORITE_CIPHERS, ...ALL_ITEM_CIPHERS],
        loading: false,
        appliedFilters: {
          cipherType: CipherType.Login,
          organization: [ORGANIZATION_OPTIONS[1].value.id],
          folder: [FOLDER_OPTIONS[0].value.id, FOLDER_OPTIONS[1].value.id],
        },
      }),
    }),
  ],
  render: () => ({
    template: `<div class="tw-flex tw-flex-col" style="height: 500px"><app-vault-popup-list-table></app-vault-popup-list-table></div>`,
  }),
  parameters: {
    // The toolbar picks its presentation from the viewport (`matchMedia`), not the host width, so
    // pin the widths rather than constraining with CSS. Every popup size is below the `md`
    // breakpoint and collapses into the sliders trigger; 1280 covers the wide row for the sidebar.
    chromatic: {
      viewports: [PopupWidthOptions.narrow, PopupWidthOptions.default, 1280],
    },
  },
};

// Both collapsible sections start closed, so only their headers render. The autofill section isn't
// `collapsible`, so it stays expanded.
export const CollapsedSections: Story = {
  decorators: [
    applicationConfig({
      providers: buildProviders({
        autoFillCiphers: AUTOFILL_CIPHERS,
        favoriteCiphers: FAVORITE_CIPHERS,
        filteredCiphers: [...AUTOFILL_CIPHERS, ...FAVORITE_CIPHERS, ...ALL_ITEM_CIPHERS],
        loading: false,
        collapsedSections: ["favorites", "allItems"],
      }),
    }),
  ],
  render: () => ({
    template: `<div class="tw-flex tw-flex-col" style="height: 500px"><app-vault-popup-list-table></app-vault-popup-list-table></div>`,
  }),
};

// The current tab is blocklisted: the autofill section heading reads "Suggested items"
// instead of "Autofill suggestions", and autofill is no longer the primary click action.
export const BlockedUri: Story = {
  decorators: [
    applicationConfig({
      providers: buildProviders({
        autoFillCiphers: AUTOFILL_CIPHERS,
        favoriteCiphers: FAVORITE_CIPHERS,
        filteredCiphers: [...AUTOFILL_CIPHERS, ...FAVORITE_CIPHERS, ...ALL_ITEM_CIPHERS],
        loading: false,
        currentUriIsBlocked: true,
      }),
    }),
  ],
  render: () => ({
    template: `<div class="tw-flex tw-flex-col" style="height: 500px"><app-vault-popup-list-table></app-vault-popup-list-table></div>`,
  }),
};
