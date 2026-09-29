import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogModule, I18nMockService } from "@bitwarden/components";

import { SHARED_FOLDERS_ROUTE } from "../../models/vault-scope";
import { BULK_DELETE_DIALOG, BulkDeleteDialogResult } from "../../tokens/bulk-delete-dialog.token";
import {
  BULK_EDIT_COLLECTION_ACCESS_DIALOG,
  BulkEditCollectionAccessResult,
} from "../../tokens/bulk-edit-collection-access-dialog.token";
import { COLLECTION_DIALOG, CollectionDialogOutcome } from "../../tokens/collection-dialog.token";

import { SharedFolderPermission } from "./shared-folder-permission";
import { SharedFoldersComponent } from "./shared-folders.component";

/** A guid: that's how a `:vaultId` segment names an organization vault — see `parseVaultScope`. */
const organizationId = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa" as OrganizationId;

type FolderFixture = {
  id: string;
  name: string;
  permissions: SharedFolderPermission;
  items: number;
};

const folders: FolderFixture[] = [
  { id: "col-1", name: "Engineering", permissions: SharedFolderPermission.Manage, items: 42 },
  { id: "col-2", name: "Finance", permissions: SharedFolderPermission.Edit, items: 8 },
  { id: "col-3", name: "Human resources", permissions: SharedFolderPermission.View, items: 0 },
  {
    id: "col-4",
    name: "Marketing",
    permissions: SharedFolderPermission.EditExceptPass,
    items: 17,
  },
  {
    id: "col-5",
    name: "Operations",
    permissions: SharedFolderPermission.ViewExceptPass,
    items: 3,
  },
  // A second Manage folder, so a selection can hold two actionable folders and the bulk actions'
  // disabled states have both cases to demonstrate.
  { id: "col-6", name: "Sales", permissions: SharedFolderPermission.Manage, items: 12 },
];

/** The collection flags each permission is resolved from — see `sharedFolderPermission`. */
const FLAGS: Readonly<
  Record<SharedFolderPermission, { manage: boolean; readOnly: boolean; hidePasswords: boolean }>
> = Object.freeze({
  [SharedFolderPermission.Manage]: { manage: true, readOnly: false, hidePasswords: false },
  [SharedFolderPermission.Edit]: { manage: false, readOnly: false, hidePasswords: false },
  [SharedFolderPermission.EditExceptPass]: {
    manage: false,
    readOnly: false,
    hidePasswords: true,
  },
  [SharedFolderPermission.View]: { manage: false, readOnly: true, hidePasswords: false },
  [SharedFolderPermission.ViewExceptPass]: { manage: false, readOnly: true, hidePasswords: true },
});

function toCollection(fixture: FolderFixture): CollectionView {
  const view = new CollectionView({
    id: fixture.id as CollectionId,
    organizationId,
    name: fixture.name,
  });
  Object.assign(view, FLAGS[fixture.permissions], { assigned: true });
  return view;
}

/** One organization-owned item per unit of a folder's count, so the Items column adds up. */
function toCiphers(fixtures: FolderFixture[]): CipherView[] {
  return fixtures.flatMap((fixture) =>
    Array.from({ length: fixture.items }, (_, index) => {
      const view = new CipherView();
      view.id = `${fixture.id}-item-${index}`;
      view.organizationId = organizationId;
      view.collectionIds = [fixture.id];
      return view;
    }),
  );
}

type StoryProps = {
  folders: FolderFixture[];
  loading: boolean;
  canCreateNewCollections: boolean;
};

/**
 * The vault the stubbed services report, built per story from its args and closed over by that
 * story's providers. Deliberately not one shared object mutated by the decorator: the docs page
 * renders every story into the same iframe, so a shared object would have been overwritten by the
 * last story's args before the first story's services were ever subscribed to, and every block
 * would list the same folders.
 *
 * Application providers rather than module ones — see {@link routes}.
 */
const withVault: Decorator = (storyFn, context) => {
  const args = context.args as StoryProps;

  const collections = args.folders.map(toCollection);
  // `null` stands for "not decrypted yet", which is what leaves the table loading.
  const ciphers = args.loading ? null : toCiphers(args.folders);
  const organizations = [
    {
      id: organizationId,
      name: "Acme corporation",
      canCreateNewCollections: args.canCreateNewCollections,
      canEditAllCiphers: false,
      limitCollectionDeletion: false,
      isAdmin: false,
    } as Organization,
  ];

  return applicationConfig({
    providers: [
      { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" as UserId }) } },
      { provide: CollectionService, useValue: { decryptedCollections$: () => of(collections) } },
      { provide: CipherService, useValue: { cipherListViews$: () => of(ciphers) } },
      { provide: OrganizationService, useValue: { organizations$: () => of(organizations) } },
    ],
  })(storyFn, context);
};

/**
 * The page's own route, mirroring `vault-routing.module.ts` (minus its guards), so the page reads
 * its organization from a real `:vaultId` param.
 *
 * Routed for real rather than given a stubbed `ActivatedRoute`: the table mirrors its sort, page,
 * and filters to the query string, and it does so with `router.navigate([], { relativeTo: route })`
 * — see `queryParamStore`. Against a stub that call can't build a segment group, so it silently
 * falls back to the current URL and rewrites it to `/`, taking Storybook's own `?id=` with it and
 * leaving the frame unreloadable. See `.claude/rules/storybook-routing.md`.
 *
 * The router builds the page from the *application* injector, not from the one Storybook gives the
 * story's own template, so everything the page injects has to be an application provider —
 * `moduleMetadata` reaches only the wrapper component the story template renders in.
 */
const routes: Routes = [
  { path: `vault/:vaultId/${SHARED_FOLDERS_ROUTE}`, component: SharedFoldersComponent },
  // Where a folder's name links. Componentless, since the drill-in is the vault page rather than
  // anything this story covers — registered only so the links resolve instead of failing to match.
  { path: `vault/:vaultId/${SHARED_FOLDERS_ROUTE}/:collectionId`, children: [] },
];

/** The URL every story renders at; hash routing keeps Storybook's own query string intact. */
const atSharedFolders: Decorator = (storyFn, context) => {
  window.location.hash = `/vault/${organizationId}/${SHARED_FOLDERS_ROUTE}`;
  return storyFn(context);
};

const template = /* HTML */ `
  <div class="tw-bg-background-alt tw-p-6">
    <router-outlet></router-outlet>
  </div>
`;

export default {
  title: "Vault/Shared Folders",
  component: SharedFoldersComponent,
  render: () => ({ template }),
  args: {
    folders,
    loading: false,
    canCreateNewCollections: true,
  },
  decorators: [
    withVault,
    atSharedFolders,
    // The outlet the route renders the page into, for the story's own template.
    moduleMetadata({ imports: [RouterOutlet] }),
    applicationConfig({
      providers: [
        provideRouter(routes, withHashLocation()),
        // `DialogService`, for `bit-table-toolbar`'s small-screen filter dialog. An app gets it
        // from its module graph; a story has to supply it.
        importProvidersFrom(DialogModule),
        // The client's dialogs, stubbed to log rather than open. Withhold `COLLECTION_DIALOG` and
        // the page lists its folders read-only — see the ReadOnly story.
        {
          provide: COLLECTION_DIALOG,
          useValue: {
            open: (params: unknown) => {
              action("collection dialog")(params);
              return Promise.resolve(CollectionDialogOutcome.Canceled);
            },
          },
        },
        {
          provide: BULK_DELETE_DIALOG,
          useValue: {
            open: (params: unknown) => {
              action("bulk delete")(params);
              return Promise.resolve(BulkDeleteDialogResult.Canceled);
            },
          },
        },
        {
          provide: BULK_EDIT_COLLECTION_ACCESS_DIALOG,
          useValue: {
            open: (params: unknown) => {
              action("bulk edit access")(params);
              return Promise.resolve(BulkEditCollectionAccessResult.Canceled);
            },
          },
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              // Toolbar
              search: "Search",
              resetSearch: "Reset search",
              add: "Add",
              itemCount: (count) => `${count} items`,
              clearAll: "Clear all",
              filter: "Filter",
              filters: "Filters",
              // Permissions filter menu, and its small-screen dialog
              removeItem: (name) => `Remove ${name}`,
              filtersSelected: (count) => `${count} selected`,
              clear: "Clear",
              done: "Done",
              all: "All",
              back: "Back",
              // Columns and rows
              name: "Name",
              permissions: "Permissions",
              viewItems: "View items",
              viewItemsHidePass: "View items, hidden passwords",
              editItems: "Edit items",
              editItemsHidePass: "Edit items, hidden passwords",
              manage: "Manage",
              items: "Items",
              options: "Options",
              optionsForItem: (name) => `Options for ${name}`,
              selectAllRows: "Select all rows",
              selectRow: "Select row",
              // Row actions
              edit: "Edit",
              access: "Access",
              delete: "Delete",
              // Paginator
              rowsPerPage: "Rows per page",
              rowsPerPageOption: (count) => `${count} rows per page`,
              previousPage: "Previous page",
              nextPage: "Next page",
              goToPage: "Go to page",
              ofPageCount: (count) => `of ${count}`,
              selectPlaceholder: "-- Select --",
              // Bulk actions bar
              editAccess: "Edit access",
              bulkActionsBar: "Bulk actions",
              bulkActionsBarAnnouncement: (count, shortcut) =>
                `${count} item(s) selected. The bulk actions bar is now available at the bottom of the screen. Press ${shortcut} to toggle focus to the bulk action bar.`,
              selectionCleared: "Selection cleared",
              selectedLowercase: "selected",
              additionalActions: "Additional actions",
              // Empty state. `noMatchingItems` doubles as the filter menu's own no-options copy;
              // the table's fallback lockup never renders, since the page always projects its own.
              noMatchingItems: "No matching items",
              clearFiltersOrTryAnother: "Clear filters or try another search term",
              noSharedFoldersAdded: "No shared folders added",
              noSharedFoldersAddedDescription:
                "Add a shared folder to securely share vault items with other members.",
            }),
        },
      ],
    }),
  ],
} as Meta<StoryProps>;

type Story = StoryObj<StoryProps>;

/**
 * The page as the web client gets it: every dialog provided, so the Options menu, the Add button,
 * and the bulk actions bar all appear.
 *
 * Select Engineering and Sales — the two the member manages — and both bulk actions stay enabled;
 * add any other folder and both disable.
 */
export const Default: Story = {};

/**
 * The Permissions chip is omitted when every folder carries the same permission: with one option it
 * has nothing to narrow. That takes the whole filter row with it, item count included.
 */
export const SinglePermission: Story = {
  args: {
    folders: folders.map((folder) => ({
      ...folder,
      permissions: SharedFolderPermission.Manage,
    })),
  },
};

/**
 * Skeleton rows stand in for the data until the vault's ciphers first decrypt. The Add button waits
 * with them: until the organization has loaded there's nothing for the dialog to save to.
 */
export const Loading: Story = {
  args: { loading: true },
};

/**
 * The desktop page, which provides no dialog at all: every write action opens one it doesn't have.
 * Without `COLLECTION_DIALOG` the Options column and the Add button go, and without either bulk
 * dialog so do the bulk actions bar and the checkbox column it would need. What's left lists the
 * folders and offers no action the client can't carry out.
 */
export const ReadOnly: Story = {
  decorators: [
    // A story's own providers are merged after the meta's, so these win over the stubs above.
    applicationConfig({
      providers: [
        { provide: COLLECTION_DIALOG, useValue: null },
        { provide: BULK_DELETE_DIALOG, useValue: null },
        { provide: BULK_EDIT_COLLECTION_ACCESS_DIALOG, useValue: null },
      ],
    }),
  ],
};

/**
 * With no folder the member manages, both bulk actions drop — and with them the checkbox column,
 * since a selection with nothing to act on would only raise an empty bar. An action the member
 * could never run is dropped rather than offered permanently disabled.
 *
 * The Options column stays — see `showOptions`.
 */
export const NoBulkActions: Story = {
  args: {
    folders: folders.filter((folder) => folder.permissions !== SharedFolderPermission.Manage),
  },
};

/** A member the organization does not let create collections loses the toolbar's Add button. */
export const NoAdd: Story = {
  args: { canCreateNewCollections: false },
};

/**
 * With no folders at all the empty state invites the Add button, which the toolbar still offers.
 *
 * The no-matches copy shares the same slot — filter the Default story down to nothing to see it,
 * with a Clear all that clears the chips and leaves the search term alone. It branches on whether
 * the organization has folders rather than on whether any row survived the filters, so searching
 * *this* story keeps the copy below.
 */
export const Empty: Story = {
  args: { folders: [] },
};

/**
 * The rows page themselves against the window, so the paginator appears only once the window is too
 * short to show every folder. Shorten this frame and the page shrinks with it; give it room for all
 * sixty and the paginator goes away.
 */
export const Pagination: Story = {
  args: {
    folders: Array.from({ length: 60 }, (_, index) => ({
      ...folders[index % folders.length],
      id: `col-${index + 1}`,
      name: `${folders[index % folders.length].name} ${Math.floor(index / folders.length) + 1}`,
      // One item apiece keeps sixty folders' worth of stub ciphers cheap.
      items: 1,
    })),
  },
};
