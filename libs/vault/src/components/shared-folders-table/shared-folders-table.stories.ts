import { RouterTestingModule } from "@angular/router/testing";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { action } from "storybook/actions";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { DialogModule, I18nMockService } from "@bitwarden/components";

import { SharedFolderPermission } from "./shared-folder-permission";
import { SharedFoldersTableBulkAction } from "./shared-folders-table-bulk-action";
import { SharedFolderRow, SharedFoldersTableRowAction } from "./shared-folders-table-row";
import { SharedFoldersTableComponent } from "./shared-folders-table.component";

const organizationId = "org-1" as OrganizationId;

const sharedFolders: SharedFolderRow[] = [
  {
    id: "col-1" as CollectionId,
    organizationId,
    name: "Engineering",
    permissions: SharedFolderPermission.Manage,
    items: 42,
  },
  {
    id: "col-2" as CollectionId,
    organizationId,
    name: "Finance",
    permissions: SharedFolderPermission.Edit,
    items: 8,
  },
  {
    id: "col-3" as CollectionId,
    organizationId,
    name: "Human resources",
    permissions: SharedFolderPermission.View,
    items: 0,
  },
  {
    id: "col-4" as CollectionId,
    organizationId,
    name: "Marketing",
    permissions: SharedFolderPermission.EditExceptPass,
    items: 17,
  },
  {
    id: "col-5" as CollectionId,
    organizationId,
    name: "Operations",
    permissions: SharedFolderPermission.ViewExceptPass,
    items: 3,
  },
  // A second Manage folder, so a multi-row selection can hold two folders the member may act on
  // and the bulk actions' disabled predicates have both states to demonstrate.
  {
    id: "col-6" as CollectionId,
    organizationId,
    name: "Sales",
    permissions: SharedFolderPermission.Manage,
    items: 12,
  },
];

/**
 * What the web client requires of a folder before it offers either bulk action over it: both Edit
 * access and Delete come down to Manage for an ordinary member (an organization admin holds them
 * over every folder regardless).
 */
const managed = (sharedFolder: SharedFolderRow): boolean =>
  sharedFolder.permissions === SharedFolderPermission.Manage;

const rowActions: SharedFoldersTableRowAction[] = [
  {
    id: "edit",
    label: "Edit",
    icon: "bwi-pencil-square",
    run: action("edit"),
  },
  {
    id: "access",
    label: "Edit access",
    icon: "bwi-users",
    run: action("access"),
  },
  {
    id: "delete",
    label: "Delete",
    icon: "bwi-trash",
    variant: "danger",
    // Deleting a folder that still holds items is a separate, confirmed flow, so the plain
    // action is offered only for empty folders.
    show: (row) => row.items === 0,
    run: action("delete"),
  },
];

/**
 * The pair the web client offers, in its order — matching the organization vault's batch bar for a
 * folders-only selection, down to the labels, the icons, and the permission each is gated on.
 *
 * Both refuse a batch containing a folder the member may not act on, so both disable rather than
 * let the click through to a dialog that would reject it.
 */
const bulkActions: SharedFoldersTableBulkAction[] = [
  {
    id: "edit-access",
    label: "Edit access",
    icon: "bwi-users",
    disabled: (rows) => rows.some((sharedFolder) => !managed(sharedFolder)),
    run: action("bulk edit access"),
  },
  {
    id: "delete",
    label: "Delete",
    icon: "bwi-trash",
    disabled: (rows) => rows.some((sharedFolder) => !managed(sharedFolder)),
    run: action("bulk delete"),
  },
];

type StoryProps = {
  sharedFolders: SharedFolderRow[];
  loading: boolean;
  rowActions: SharedFoldersTableRowAction[];
  bulkActions: SharedFoldersTableBulkAction[];
  canAdd: boolean;
};

const template = /* HTML */ `
  <div class="tw-bg-background-alt tw-p-6">
    <vault-shared-folders-table
      [sharedFolders]="sharedFolders"
      [loading]="loading"
      [rowActions]="rowActions"
      [bulkActions]="bulkActions"
      [canAdd]="canAdd"
      (add)="add()"
    ></vault-shared-folders-table>
  </div>
`;

export default {
  title: "Vault/Shared Folders Table",
  component: SharedFoldersTableComponent,
  render: (args) => ({ props: { ...args, add: action("add") }, template }),
  args: {
    sharedFolders,
    loading: false,
    rowActions,
    bulkActions,
    canAdd: true,
  },
  decorators: [
    moduleMetadata({
      // `DialogModule` for its `DialogService` provider: `bit-table-toolbar` injects it for the
      // small-screen filter dialog. `RouterTestingModule` for the name column's `routerLink`.
      // Apps get both from their own module graph; a story has to supply them.
      imports: [DialogModule, RouterTestingModule],
      providers: [
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
              // Permissions filter chip, and its small-screen dialog
              filterByName: (name) => `Filter by ${name}`,
              removeItem: (name) => `Remove ${name}`,
              filtersSelected: (count) => `${count} selected`,
              clear: "Clear",
              done: "Done",
              all: "All",
              back: "Back",
              backTo: (name) => `Back to ${name}`,
              viewItemsIn: (name) => `View items in ${name}`,
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
              // Paginator
              rowsPerPage: "Rows per page",
              rowsPerPageOption: (count) => `${count} rows per page`,
              previousPage: "Previous page",
              nextPage: "Next page",
              goToPage: "Go to page",
              ofPageCount: (count) => `of ${count}`,
              selectPlaceholder: "-- Select --",
              // Bulk actions bar
              bulkActionsBar: "Bulk actions",
              bulkActionsBarAnnouncement: (count, shortcut) =>
                `${count} item(s) selected. The bulk actions bar is now available at the bottom of the screen. Press ${shortcut} to toggle focus to the bulk action bar.`,
              selectionCleared: "Selection cleared",
              selectedLowercase: "selected",
              additionalActions: "Additional actions",
              // Empty state
              nothingToShow: "Nothing to show",
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
 * The table as a host gets it out of the box: bind `sharedFolders` and `rowActions`, and the
 * columns, sorting, search, and Permissions chip all follow from the rows. Sort by any of Name,
 * Permissions, or Items; the search box matches on name; the chip offers each permission present
 * in the rows, with a faceted count apiece.
 *
 * `bulkActions` adds the checkbox column and the bulk actions bar the checkboxes raise. Select
 * Engineering and Sales — the two the member manages — and both Edit access and Delete stay
 * enabled; add any other folder and both disable, their predicates being re-resolved against the
 * selection on every change.
 */
export const Default: Story = {};

/**
 * The Permissions chip is omitted when every folder carries the same permission — with one option
 * it could only ever select every row, so it has nothing to narrow.
 */
export const SinglePermission: Story = {
  args: {
    sharedFolders: sharedFolders.map((sharedFolder) => ({
      ...sharedFolder,
      permissions: SharedFolderPermission.Manage,
    })),
  },
};

/** Bind `loading` while the client resolves the folders; skeleton rows stand in for the data. */
export const Loading: Story = {
  args: { loading: true },
};

/**
 * With no `rowActions` the Options column is dropped rather than left as a header over empty cells,
 * and the width it held passes to Items so the columns still span the table.
 *
 * What the desktop client lists with — its shared folders page is read-only, every row action being
 * a dialog it doesn't have.
 */
export const NoRowActions: Story = {
  args: { rowActions: [] },
};

/**
 * With no `bulkActions` the rows lose their checkboxes: a selection with nothing to act on would
 * only raise an empty bar.
 *
 * What the web client falls back to for a member who manages none of the listed folders — it drops
 * an action it could never enable rather than offering it permanently disabled, and dropping both
 * takes the checkbox column with them.
 */
export const NoBulkActions: Story = {
  args: {
    bulkActions: [],
    sharedFolders: sharedFolders.filter((sharedFolder) => !managed(sharedFolder)),
  },
};

/**
 * Without `canAdd` the toolbar drops its Add button, leaving the search field and the Permissions
 * chip. What the web client falls back to for a member the organization does not let create
 * collections — the button is dropped rather than offered into a dialog that would refuse to save.
 */
export const NoAdd: Story = {
  args: { canAdd: false },
};

/**
 * With no rows at all the empty state invites the host's Add button. Search or filter the
 * populated table down to nothing instead and the same slot switches to the no-matches copy,
 * with a Clear all that leaves the search term alone.
 */
export const Empty: Story = {
  args: { sharedFolders: [] },
};

/**
 * The rows page themselves against the window: a page holds as many as fit below the table's
 * header, so the paginator appears only once the window is too short to show every folder at once.
 * Sixty folders here, which no ordinary window fits — shorten this frame and the page shrinks with
 * it; give it room enough for all sixty and the paginator goes away.
 */
export const Pagination: Story = {
  args: {
    sharedFolders: Array.from({ length: 60 }, (_, index) => ({
      ...sharedFolders[index % sharedFolders.length],
      id: `col-${index + 1}` as CollectionId,
      name: `${sharedFolders[index % sharedFolders.length].name} ${
        Math.floor(index / sharedFolders.length) + 1
      }`,
    })),
  },
};
