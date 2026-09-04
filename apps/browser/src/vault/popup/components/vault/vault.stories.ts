import { LiveAnnouncer } from "@angular/cdk/a11y";
import { signal } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router } from "@angular/router";
import { applicationConfig, componentWrapperDecorator, Meta, StoryObj } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService, OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { NudgesService, NudgeType, PremiumUpsellService } from "@bitwarden/angular/vault";
import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm/angular";
import {
  InternalOrganizationServiceAbstraction,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  CipherId,
  CollectionId,
  OrganizationId,
  PolicyId,
  SecurityTaskId,
  UserId,
} from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
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
  SecurityTask,
  SecurityTaskStatus,
  SecurityTaskType,
  TaskService,
} from "@bitwarden/common/vault/tasks";
import {
  CompactModeService,
  DialogService,
  I18nMockService,
  ToastService,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { StateProvider } from "@bitwarden/state";
import { featureFlagModes } from "@bitwarden/storybook";
import { PasswordRepromptService, VaultCopyButtonsService } from "@bitwarden/vault";

import AutofillService from "../../../../autofill/services/autofill.service";
import { PopupRouterCacheService } from "../../../../platform/popup/view-cache/popup-router-cache.service";
import { IntroCarouselService } from "../../services/intro-carousel.service";
import { VaultPopupAutofillService } from "../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../services/vault-popup-items.service";
import {
  MY_VAULT_ID,
  VaultPopupListFiltersService,
} from "../../services/vault-popup-list-filters.service";
import { VaultPopupListTableFiltersService } from "../../services/vault-popup-list-table-filters.service";
import { VaultPopupLoadingService } from "../../services/vault-popup-loading.service";
import { VaultPopupScrollPositionService } from "../../services/vault-popup-scroll-position.service";
import { VaultPopupSectionService } from "../../services/vault-popup-section.service";
import { PopupCipherViewLike } from "../../views/popup-cipher.view";

import { VaultComponent } from "./vault.component";

// `NewItemDropdownComponent.ngOnInit` reaches for `chrome.windows`, which is undefined outside the
// extension runtime, so the popup header throws while rendering. A stub reporting a single active
// tab keeps it on its normal path.
window.chrome = {
  ...window.chrome,
  windows: {
    getCurrent: (_opts: unknown, cb: (win: unknown) => void) =>
      cb({ id: 1, tabs: [{ id: 1, active: true, url: "https://example.com/", windowId: 1 }] }),
  },
  tabs: {
    query: (_opts: unknown, cb: (tabs: unknown[]) => void) =>
      cb([{ id: 1, active: true, url: "https://example.com/", windowId: 1 }]),
  },
} as unknown as typeof chrome;

// Fixtures must be deterministic, or Chromatic diffs every story against its baseline on each
// build. `pick` rotates through each list in a fixed order, with its own cursor per array.
const pickCursors = new WeakMap<readonly unknown[], number>();
const pick = <T>(items: readonly T[]): T => {
  const next = pickCursors.get(items) ?? 0;
  pickCursors.set(items, next + 1);
  return items[next % items.length];
};

// Ids are snapshotted (as `track` keys and in collection tooltips), so a counter replaces
// `crypto.randomUUID()`.
let idCounter = 0;
const nextId = (): string => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, "0")}`;

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
] as const;
const FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley"] as const;
const LAST_NAMES = ["Rivera", "Chen", "Patel", "Okafor", "Nguyen", "Silva"] as const;
const EMAIL_DOMAINS = ["gmail.com", "proton.me", "outlook.com", "fastmail.com"] as const;
const CARD_BRANDS = ["Visa", "Mastercard", "American Express", "Discover"] as const;

const makeEmail = (first = pick(FIRST_NAMES), last = pick(LAST_NAMES)): string =>
  `${first}.${last}@${pick(EMAIL_DOMAINS)}`.toLowerCase();

/**
 * Real `CipherView` instances rather than hand-mocked shapes: rows read derived values off the
 * model (e.g. the `subTitle` getter), so building the class beats mocking every getter.
 */
const baseCipher = (type: CipherType, name: string): CipherView => {
  const cipher = new CipherView();
  cipher.id = nextId();
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
  const organizationId = nextId() as OrganizationId;
  cipher.organizationId = organizationId;
  cipher.collectionIds = collectionNames.map(() => nextId());

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
  // No username, so its accessible title omits the field and its subtitle is blank.
  makeLogin({ name: "Password-only Login", username: undefined }),
];

const FAVORITE_CIPHERS: PopupCipherViewLike[] = [makeLogin({ favorite: true }), makeCard()];

const ALL_ITEM_CIPHERS: PopupCipherViewLike[] = [
  makeLogin(),
  makeLogin(),
  makeCard(),
  makeIdentity(),
  // Has an attachment, so the paperclip icon renders with its `attachments` accessible title.
  withAttachment(makeLogin()),
  // In an organization across multiple shared folders: the org icon tooltip reads `nSharedFolders`.
  inOrganization(makeLogin(), ProductTierType.Enterprise, ["Engineering", "Marketing"]),
];

const STORY_USER_ID = "00000000-0000-4000-8000-0000000000ff" as UserId;
const STORY_ORG_ID = "00000000-0000-4000-8000-0000000000fe" as OrganizationId;

/**
 * Options for the list table's toolbar filter chips (VFO1 on). Each chip only renders when its
 * stream has entries, so these decide which of Vault / Shared folders / My folders appear at all.
 * IDs are fixed rather than generated, since they feed chip labels that Chromatic snapshots.
 */
const FILTER_ORGANIZATION_OPTIONS = [
  { value: { id: MY_VAULT_ID } as Organization, label: "My vault", icon: "bwi-user" as const },
  { value: { id: STORY_ORG_ID } as Organization, label: "Acme Co", icon: "bwi-business" as const },
];

// The names the collection groups are labeled from, keyed by organization id.
const FILTER_ORGANIZATION_NAMES = new Map(
  FILTER_ORGANIZATION_OPTIONS.map((option) => [option.value.id, option.label]),
);

const FILTER_COLLECTION_OPTIONS = [
  {
    value: { id: "00000000-0000-4000-8000-0000000000fa", name: "Engineering" } as CollectionView,
    label: "Engineering",
  },
  {
    value: { id: "00000000-0000-4000-8000-0000000000fb", name: "Marketing" } as CollectionView,
    label: "Marketing",
  },
];

// Nested, to exercise the chip's tree flattening: the child renders as its own option, labeled
// with only its trailing segment ("EU", never "Work/EU").
const FILTER_FOLDER_OPTIONS = [
  {
    value: { id: "00000000-0000-4000-8000-0000000000fc", name: "Work" } as FolderView,
    label: "Work",
    children: [
      {
        value: { id: "00000000-0000-4000-8000-0000000000fd", name: "Work/EU" } as FolderView,
        label: "EU",
      },
    ],
  },
  {
    value: { id: "00000000-0000-4000-8000-0000000000f9", name: "Personal" } as FolderView,
    label: "Personal",
  },
];

const FILTER_CIPHER_TYPE_OPTIONS = [
  { value: CipherType.Login, label: "Login" },
  { value: CipherType.Card, label: "Card" },
  { value: CipherType.Identity, label: "Identity" },
  { value: CipherType.SecureNote, label: "Note" },
];

/**
 * Fixed so the org-notification banner's revision date never shifts between Chromatic builds. The
 * banner compares this against the dismissal timestamp in state (kept `null`) to decide visibility.
 */
const FIXED_REVISION_DATE = new Date("2024-01-01T00:00:00.000Z");

type StoryArgs = {
  /** Puts the vault in its `Empty` state, which swaps the whole body for the empty-vault graphic. */
  emptyVault?: boolean;
  /** With `hasSearchText`, produces the `NoResults` state. */
  noFilteredResults?: boolean;
  hasSearchText?: boolean;
  /** Takes precedence over `NoResults` and unmounts the table even when the flag is on. */
  showDeactivatedOrg?: boolean;
  /** Nudges to report as active. Everything not listed here reports `false`. */
  activeNudges?: NudgeType[];
  /** `premiumUpsellService.showUpsell()` — the third condition behind the premium spotlight. */
  showPremiumUpsell?: boolean;
  /** When true, an enabled OrganizationUserNotification policy is present so the banner renders. */
  showOrgNotification?: boolean;
  /**
   * Number of pending at-risk-password tasks. Each is bound to one of the story's real ciphers, so
   * anything above `ALL_ITEM_CIPHERS.length` is capped.
   */
  atRiskPasswordCount?: number;
  /**
   * Shows the at-risk callout's success variant instead: a completed task, no pending ones, and
   * prior interaction recorded in state.
   */
  showAtRiskSecuredBanner?: boolean;
};

/**
 * The org-user-notification policy backing `vault-organization-user-notifications`.
 *
 * That component (like `vault-at-risk-password-callout`) declares its service in its own
 * `providers`, and a component injector outranks `applicationConfig`, so the service can't be
 * swapped from a story. Both run for real, steered through the root-level dependencies they read
 * (`PolicyService`, `StateProvider`, `TaskService`).
 */
const buildNotificationPolicies = (args: StoryArgs) => {
  if (!args.showOrgNotification) {
    return [];
  }

  const policy = new Policy();
  policy.id = "00000000-0000-4000-8000-0000000000fd" as PolicyId;
  policy.organizationId = STORY_ORG_ID;
  policy.type = PolicyType.OrganizationUserNotification;
  policy.enabled = true;
  policy.revisionDate = FIXED_REVISION_DATE;
  policy.data = {
    header: "Scheduled maintenance",
    description:
      "Your organization will be unavailable Saturday from 02:00-04:00 UTC while we upgrade.",
    buttonText: "Learn more",
    showAfterEveryLogin: false,
  };
  return [policy];
};

/**
 * Tasks backing `vault-at-risk-password-callout`. `pendingTasks$` joins each task to a cipher by
 * `cipherId` and keeps only the editable, password-visible ones, so tasks have to point at ciphers
 * the story provides and `CipherService.cipherViews$` has to return them.
 */
const buildAtRiskTask = (
  cipherId: PopupCipherViewLike["id"],
  status: SecurityTaskStatus,
): SecurityTask =>
  new SecurityTask({
    id: nextId() as SecurityTaskId,
    organizationId: STORY_ORG_ID,
    cipherId: cipherId as CipherId,
    type: SecurityTaskType.UpdateAtRiskCredential,
    status,
    creationDate: FIXED_REVISION_DATE,
    revisionDate: FIXED_REVISION_DATE,
  });

const buildAtRiskTasks = (args: StoryArgs) => {
  if (args.showAtRiskSecuredBanner) {
    // The success banner requires a completed task AND zero pending ones.
    return {
      pending: [] as SecurityTask[],
      completed: [buildAtRiskTask(ALL_ITEM_CIPHERS[0].id, SecurityTaskStatus.Completed)],
    };
  }

  const count = Math.min(args.atRiskPasswordCount ?? 0, ALL_ITEM_CIPHERS.length);
  return {
    pending: ALL_ITEM_CIPHERS.slice(0, count).map((cipher) =>
      buildAtRiskTask(cipher.id, SecurityTaskStatus.Pending),
    ),
    completed: [] as SecurityTask[],
  };
};

const buildProviders = (args: StoryArgs) => {
  const emptyVault$ = new BehaviorSubject(args.emptyVault ?? false);
  const noFilteredResults$ = new BehaviorSubject(args.noFilteredResults ?? false);
  const showDeactivatedOrg$ = new BehaviorSubject(args.showDeactivatedOrg ?? false);
  const hasSearchText$ = new BehaviorSubject(args.hasSearchText ?? false);

  const populated = !args.emptyVault && !args.noFilteredResults;
  const allItems = populated ? [...AUTOFILL_CIPHERS, ...FAVORITE_CIPHERS, ...ALL_ITEM_CIPHERS] : [];

  const activeNudges = new Set(args.activeNudges ?? []);
  const atRiskTasks = buildAtRiskTasks(args);
  // The at-risk callout's service joins tasks to ciphers, so these have to be visible to it.
  const atRiskCiphers = atRiskTasks.pending.length > 0 ? ALL_ITEM_CIPHERS : [];

  return [
    // `vault-fade-in-out` uses Angular animations, which throw NG05105 without a provider. Noop
    // rather than real, so Chromatic never snapshots a partially-faded frame.
    provideNoopAnimations(),
    // `BrowserPopupUtils.inSidebar(window)` reads the window URL, so a fake keeps stories off the
    // sidebar-only autofill refresh control.
    { provide: WINDOW, useValue: { location: { href: "https://example.com/" } } as Window },
    {
      provide: VaultPopupItemsService,
      useValue: {
        emptyVault$,
        noFilteredResults$,
        showDeactivatedOrg$,
        hasSearchText$,
        favoriteCiphers$: of(populated ? FAVORITE_CIPHERS : []),
        remainingCiphers$: of(populated ? ALL_ITEM_CIPHERS : []),
        filteredCiphers$: of(allItems),
        autoFillCiphers$: of(populated ? AUTOFILL_CIPHERS : []),
        cipherCount$: of(allItems.length),
        searchText$: of(""),
        loading$: of(false),
        // Drives the autofill section's type grouping and its empty-state tip.
        hasFilterApplied$: of(false),
        applyFilter: () => {},
      },
    },
    {
      provide: VaultPopupListFiltersService,
      useValue: {
        // The component's `loading$` stays true until this emits, so it can't be a bare `Subject`.
        allFilters$: of({
          organizations: FILTER_ORGANIZATION_OPTIONS,
          collections: FILTER_COLLECTION_OPTIONS,
          folders: FILTER_FOLDER_OPTIONS,
        }),
        // No filters applied, matching `hasFilterApplied$: of(false)` above.
        filters$: of({}),
        filterVisibilityState$: of(false),
        numberOfAppliedFilters$: of(0),
        organizations$: of(FILTER_ORGANIZATION_OPTIONS),
        collections$: of(FILTER_COLLECTION_OPTIONS),
        folders$: of(FILTER_FOLDER_OPTIONS),
        cipherTypes$: of(FILTER_CIPHER_TYPE_OPTIONS),
        // `app-vault-list-filters` binds this to a `[formGroup]`, so it has to be a real one.
        filterForm: new FormBuilder().group({
          organization: [null],
          collection: [null],
          folder: [null],
          cipherType: [null],
        }),
        updateFilterVisibility: () => Promise.resolve(),
      },
    },
    {
      provide: VaultPopupListTableFiltersService,
      useValue: {
        restoreFilters$: () => of({}),
        saveFilters: () => {},
        selectedOrganizations: signal<Organization[]>([]),
        cipherTypes$: of(FILTER_CIPHER_TYPE_OPTIONS),
        organizations$: of(FILTER_ORGANIZATION_OPTIONS),
        organizationNames$: of(FILTER_ORGANIZATION_NAMES),
        collections$: of(FILTER_COLLECTION_OPTIONS),
        folders$: of(FILTER_FOLDER_OPTIONS),
      },
    },
    { provide: VaultPopupLoadingService, useValue: { loading$: of(false) } },
    {
      provide: VaultPopupScrollPositionService,
      useValue: { start: () => {}, stop: () => {} },
    },
    {
      provide: NudgesService,
      useValue: {
        showNudgeSpotlight$: (type: NudgeType) => of(activeNudges.has(type)),
        dismissNudge: () => Promise.resolve(),
      },
    },
    {
      // One of three conditions behind the premium spotlight — see `showPremiumSpotlight$`.
      provide: PremiumUpsellService,
      useValue: { showUpsell: () => args.showPremiumUpsell ?? false },
    },
    {
      provide: AccountService,
      useValue: { activeAccount$: of({ id: STORY_USER_ID, email: "story@example.com" }) },
    },
    {
      provide: CipherService,
      useValue: {
        // No decryption failures, so the failure dialog never opens during a snapshot.
        failedToDecryptCiphers$: () => of([]),
        cipherViews$: () => of(atRiskCiphers),
        ciphers$: () => of({}),
      },
    },
    {
      provide: AutomaticUserConfirmationService,
      useValue: {
        // False keeps the auto-confirm setup dialog from opening over every snapshot.
        canManageAutoConfirm$: () => of(false),
        configuration$: () => of({ enabled: false, showBrowserNotification: false }),
        upsert: () => Promise.resolve(),
        bulkAutoConfirmPendingUsers: () => Promise.resolve(),
      },
    },
    { provide: SearchService, useValue: { isCipherSearching$: of(false) } },
    // `VaultComponent` hardcodes `useClass: DefaultVaultItemsTransferService` in its own
    // `providers`, which outrank `applicationConfig`, so the real implementation is always
    // constructed and these two dependencies of it have to be satisfied here.
    { provide: OrganizationUserApiService, useValue: {} },
    { provide: SyncService, useValue: { fullSync: () => Promise.resolve(true) } },
    // The real CDK announcer tears its live element down with the first fixture, so later ones
    // would announce into a detached node.
    { provide: LiveAnnouncer, useValue: { announce: () => Promise.resolve(), clear: () => {} } },
    {
      provide: IntroCarouselService,
      useValue: { setIntroCarouselDismissed: () => Promise.resolve() },
    },
    {
      provide: VaultPopupAutofillService,
      useValue: {
        currentTabIsOnBlocklist$: of(false),
        currentAutofillTab$: of(null),
        autofillAllowed$: of(false),
        showCurrentTabIsBlockedBanner$: of(false),
        showFillAssistActiveBanner$: of(false),
        doAutofill: () => Promise.resolve(),
      },
    },
    {
      provide: VaultPopupSectionService,
      useValue: {
        getOpenDisplayStateForSection: () => () => true,
        updateSectionOpenStoredState: () => Promise.resolve(),
      },
    },
    { provide: VaultCopyButtonsService, useValue: { showQuickCopyActions$: of(false) } },
    { provide: CompactModeService, useValue: { enabled$: of(false) } },
    { provide: VaultSettingsService, useValue: { clickItemsToAutofillVaultView$: of(true) } },
    {
      provide: PolicyService,
      useValue: { policiesByType$: () => of(buildNotificationPolicies(args)) },
    },
    {
      // Both the org-notifications and at-risk services read state through `getUser`, keyed by
      // their own `UserKeyDefinition`. Everything defaults to `null` (nothing dismissed); only the
      // at-risk key carries a value, since its success banner is gated on prior interaction.
      provide: StateProvider,
      useValue: {
        getUserState$: () => of(null),
        // Matched on the literal key: `@bitwarden/vault` doesn't re-export
        // `AT_RISK_PASSWORD_CALLOUT_KEY`, and widening its public API for a story isn't worth it.
        getUser: (_userId: UserId, key: { key: string }) => ({
          state$:
            key?.key === "atRiskPasswords" && args.showAtRiskSecuredBanner
              ? of({ hasInteractedWithTasks: true, tasksBannerDismissed: false })
              : of(null),
          update: () => Promise.resolve(),
        }),
      },
    },
    { provide: RestrictedItemTypesService, useValue: { restricted$: of([]) } },
    {
      provide: EnvironmentService,
      useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
    },
    {
      // Favicons off, so snapshots don't depend on remote favicon fetches.
      provide: DomainSettingsService,
      useValue: { showFavicons$: of(false) },
    },
    {
      provide: BillingAccountProfileStateService,
      useValue: { hasPremiumFromAnySource$: () => of(false) },
    },
    { provide: OrganizationService, useValue: { hasOrganizations: () => of(false) } },
    {
      provide: InternalOrganizationServiceAbstraction,
      useValue: { organizations$: () => of([]), hasOrganizations: () => of(false) },
    },
    { provide: CollectionService, useValue: { decryptedCollections$: () => of([]) } },
    {
      provide: CipherAuthorizationService,
      useValue: { canDeleteCipher$: () => of(false), canCloneCipher$: () => of(false) },
    },
    { provide: CipherArchiveService, useValue: { userCanArchive$: () => of(false) } },
    {
      provide: TaskService,
      useValue: {
        pendingTasks$: () => of(atRiskTasks.pending),
        completedTasks$: () => of(atRiskTasks.completed),
      },
    },
    {
      provide: PlatformUtilsService,
      useValue: {
        getAutofillKeyboardShortcut: () => Promise.resolve("Ctrl+Shift+L"),
        isSafari: () => false,
        isChrome: () => true,
        isFirefox: () => false,
      },
    },
    {
      provide: AvatarService,
      useValue: { avatarColor$: of("#175DDC") },
    },
    {
      provide: AuthService,
      useValue: {
        activeAccountStatus$: of(AuthenticationStatus.Unlocked),
        authStatuses$: of({}),
        getAuthStatus: () => Promise.resolve(AuthenticationStatus.Unlocked),
      },
    },
    { provide: AutofillService, useValue: {} },
    { provide: EventCollectionService, useValue: { collect: () => Promise.resolve() } },
    // Pulled in by the real `DialogService`, which is reachable via component-level providers.
    {
      provide: LogService,
      useValue: { debug: () => {}, info: () => {}, warning: () => {}, error: () => {} },
    },
    { provide: TotpService, useValue: {} },
    { provide: PasswordRepromptService, useValue: {} },
    { provide: ToastService, useValue: { showToast: () => {} } },
    { provide: DialogService, useValue: { open: () => ({ closed: of(undefined) }) } },
    { provide: PopupRouterCacheService, useValue: { back: () => Promise.resolve() } },
    {
      // The real `DialogService`'s constructor subscribes to `router.events`, so `events` has to
      // be a real stream or every story dies before rendering.
      provide: Router,
      useValue: {
        navigate: () => Promise.resolve(true),
        events: of(),
        createUrlTree: () => ({}),
        serializeUrl: () => "",
        url: "/",
      },
    },
    {
      provide: ActivatedRoute,
      useValue: { snapshot: { queryParams: {}, paramMap: new Map() }, queryParams: of({}) },
    },
    {
      provide: I18nService,
      useFactory: () =>
        new I18nMockService({
          // Page chrome
          vault: "Vault",
          loading: "Loading",
          loadingVault: "Loading vault",
          vaultLoaded: "Vault loaded",
          // Empty-vault state
          yourVaultIsEmpty: "Your vault is empty",
          emptyVaultDescription: "Add an item to get started protecting your accounts.",
          newLogin: "New login",
          // No-results state
          noItemsMatchSearch: "No items match your search",
          clearFiltersOrTryAnother: "Clear filters or try another search term",
          // Deactivated-org state
          organizationIsDeactivated: "Organization is deactivated",
          contactYourOrgAdmin: "Contact your organization administrator for assistance.",
          // Premium spotlight
          unlockAdvancedSecurity: "Unlock advanced security",
          unlockAdvancedSecurityDesc: "Get more protection with Bitwarden Premium.",
          explorePremium: "Explore Premium",
          // Empty-vault spotlight
          emptyVaultNudgeTitle: "Import your data",
          emptyVaultNudgeBody: "Bring your existing passwords into Bitwarden.",
          emptyVaultNudgeButton: "Import data",
          // Has-items spotlight
          hasItemsVaultNudgeTitle: "Get the most out of your vault",
          hasItemsVaultNudgeBodyOne: "Autofill logins as you browse",
          hasItemsVaultNudgeBodyTwo: "Generate strong, unique passwords",
          hasItemsVaultNudgeBodyThree: "Sync your vault across every device",
          // Legacy header: search + filters
          search: "Search",
          searchVault: "Search vault",
          filterVault: "Filter vault",
          filters: "Filters",
          filterApplied: "1 filter applied",
          filterAppliedPlural: "__$1__ filters applied",
          collection: "Collection",
          folder: "Folder",
          type: "Type",
          // The list table's filter chips (flag on). The vfo1-terminology chips resolve to the
          // plural VFO1 keys, so omitting those makes `Vfo1I18nPipe` throw.
          vaults: "Vaults",
          sharedFolders: "Shared folders",
          myFolders: "My folders",
          all: "All",
          // The chips' menus, and the dialog the filter row collapses into below `md`.
          filter: "Filter",
          filtersSelected: "__$1__ selected",
          removeItem: "Remove __$1__",
          clear: "Clear",
          clearAll: "Clear all",
          done: "Done",
          noMatchingItems: "No matching items",
          // Legacy grouped list containers
          searchResults: "Search results",
          favorites: "Favorites",
          allItems: "All items",
          items: "Items",
          itemCount: "__$1__ items",
          // Table presentation (flag on)
          resetSearch: "Reset search",
          name: "Name",
          autofillSuggestions: "Autofill suggestions",
          itemSuggestions: "Suggested items",
          refresh: "Refresh",
          nothingToShow: "Nothing to show",
          typeLogin: "Login",
          typeCard: "Card",
          typeIdentity: "Identity",
          fill: "Fill",
          // Accessible row titles
          autofillTitle: "Autofill - __$1__",
          autofillTitleWithField: "Autofill - __$1__ - __$2__",
          viewItemTitle: "View item - __$1__",
          viewItemTitleWithField: "View item - __$1__ - __$2__",
          attachments: "Attachments",
          nSharedFolders: "__$1__ shared folders",
          // The legacy container's org-icon tooltip uses this rather than `nSharedFolders`.
          nCollections: "__$1__ collections",
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
          // Item menu
          autofillVerb: "Autofill",
          view: "View",
          favorite: "Favorite",
          unfavorite: "Unfavorite",
          edit: "Edit",
          clone: "Clone",
          assignToCollections: "Assign to shared folders",
          archiveVerb: "Archive",
          upgrade: "Upgrade",
          upgradeToUseArchive: "Upgrade to use archive",
          delete: "Delete",
          launchWebsiteForName: "Launch __$1__",
          // New-item dropdown / header controls. Every `labelKey` in `CIPHER_MENU_ITEMS` has to
          // resolve or the dropdown throws while rendering.
          new: "New",
          add: "Add",
          typeNote: "Note",
          typeSecureNote: "Note",
          typeSshKey: "SSH key",
          typeBankAccount: "Bank account",
          typePassport: "Passport",
          typeDriversLicense: "Driver's license",
          popOutNewWindow: "Pop out to a new window",
          account: "Account",
          back: "Back",
          bitwardenAccount: "Bitwarden account",
          switchAccounts: "Switch accounts",
          // Banners whose host is always present even when their service reports nothing to show.
          autofillSuggestionsTip: "Autofill suggestions will appear here",
          autofillBlockedNoticeV2: "Autofill is blocked for this site",
          autofillBlockedNoticeGuidance: "Unblock this site to use autofill",
          fillAssistActiveNotice: "Fill Assist is active for this site",
          // At-risk password callout
          reviewXAtRiskPassword: "Review __$1__ at-risk password",
          reviewXAtRiskPasswordsPlural: "Review __$1__ at-risk passwords",
          atRiskLoginsSecured: "At-risk logins secured",
        }),
    },
  ];
};

export default {
  title: "Browser/Vault/VaultComponent",
  component: VaultComponent,
  parameters: {
    // Snapshots every story twice: `vfo1-foundation` off (legacy header + grouped containers) and
    // on (`app-vault-popup-list-table`).
    chromatic: {
      modes: featureFlagModes(FeatureFlag.VFO1Foundation),
    },
  },
} as Meta<VaultComponent>;

// `StoryArgs` is the input to `buildProviders`, not Storybook args, so the Story type is keyed on
// the component alone.
type Story = StoryObj<VaultComponent>;

/**
 * The popup renders at a fixed extension-popup size, and the table's `height="fill"` sizing needs
 * an unbroken flex chain to a bounded ancestor. `app-vault` needs `tw-flex-1 tw-min-h-0`
 * explicitly: it's a routed component in the extension but an ordinary flex child here, so it would
 * otherwise size to content and collapse `popup-page`'s scroll region to nothing.
 */
const popupFrame = componentWrapperDecorator(
  (story) =>
    `<div class="tw-flex tw-flex-col" style="width: 380px; height: 600px">
       <div class="tw-flex tw-flex-col tw-flex-1 tw-min-h-0 [&>app-vault]:tw-flex-1 [&>app-vault]:tw-min-h-0">${story}</div>
     </div>`,
);

const buildStory = (args: StoryArgs): Story => ({
  decorators: [applicationConfig({ providers: buildProviders(args) }), popupFrame],
  render: () => ({ template: `<app-vault></app-vault>` }),
});

/** Autofill suggestions, favorites, and the full item list, with no spotlights or banners. */
export const Populated: Story = buildStory({});

export const EmptyVault: Story = buildStory({ emptyVault: true });

/** A search term is active and matched nothing. With the flag on the table stays mounted. */
export const NoSearchResults: Story = buildStory({
  hasSearchText: true,
  noFilteredResults: true,
});

/** Takes precedence over every other state and unmounts the table even when the flag is on. */
export const DeactivatedOrg: Story = buildStory({ showDeactivatedOrg: true });

/**
 * `showPremiumSpotlight$` requires all three: the PremiumUpgrade nudge on, the HasVaultItems nudge
 * off (it wins when both are active), and `showUpsell()` true.
 */
export const WithPremiumSpotlight: Story = buildStory({
  activeNudges: [NudgeType.PremiumUpgrade],
  showPremiumUpsell: true,
});

export const WithHasItemsNudge: Story = buildStory({
  activeNudges: [NudgeType.HasVaultItems],
});

/**
 * The at-risk-password callout's warning banner. It bleeds past the container's horizontal padding
 * via its own `-tw-m-5 tw-px-2`, so this is the story to check that bleed against the edges.
 */
export const WithAtRiskPasswords: Story = buildStory({ atRiskPasswordCount: 3 });

/** Singular copy: `reviewXAtRiskPassword` rather than its plural key. */
export const WithSingleAtRiskPassword: Story = buildStory({ atRiskPasswordCount: 1 });

/** The success variant — a completed task, nothing pending, and prior interaction in state. */
export const WithAtRiskPasswordsSecured: Story = buildStory({ showAtRiskSecuredBanner: true });

/**
 * The at-risk callout and the org-notification banner stacked, where their bleed has to agree — a
 * horizontal mismatch shows as one banner stopping short of the other. Needs
 * `pm-31948-org-user-notification-banner` ticked in the Feature Flags panel for the lower banner.
 */
export const WithAtRiskPasswordsAndNotifications: Story = buildStory({
  atRiskPasswordCount: 2,
  showOrgNotification: true,
});

/**
 * With the org-user-notifications banner present
 */
export const WithNotifications: Story = {
  ...buildStory({ showOrgNotification: true }),
};
