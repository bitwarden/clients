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
];

const rowActions: SharedFoldersTableRowAction[] = [
  {
    id: "edit",
    label: "Edit",
    icon: "bwi-pencil-square",
    run: action("edit"),
  },
  {
    id: "access",
    label: "Manage access",
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

const bulkActions: SharedFoldersTableBulkAction[] = [
  {
    id: "access",
    label: "Manage access",
    icon: "bwi-users",
    run: action("bulk access"),
  },
  {
    id: "delete",
    label: "Delete",
    icon: "bwi-trash",
    // As with the row action, deleting folders that still hold items is a separate, confirmed flow.
    disabled: (rows) => rows.some((sharedFolder) => sharedFolder.items > 0),
    run: action("bulk delete"),
  },
];

type StoryProps = {
  sharedFolders: SharedFolderRow[];
  loading: boolean;
  rowActions: SharedFoldersTableRowAction[];
  bulkActions: SharedFoldersTableBulkAction[];
};

const template = /* HTML */ `
  <div class="tw-bg-background-alt tw-p-6">
    <vault-shared-folders-table
      [sharedFolders]="sharedFolders"
      [loading]="loading"
      [rowActions]="rowActions"
      [bulkActions]="bulkActions"
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
 * `bulkActions` adds the checkbox column and the bulk actions bar the checkboxes raise. Select a
 * folder that still holds items to watch Delete disable itself — its `disabled` predicate is
 * re-resolved against the selection on every change.
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

/** With no `rowActions` the Options menu trigger is omitted from every row. */
export const NoRowActions: Story = {
  args: { rowActions: [] },
};

/**
 * With no `bulkActions` the rows lose their checkboxes: a selection with nothing to act on would
 * only raise an empty bar.
 */
export const NoBulkActions: Story = {
  args: { bulkActions: [] },
};

/**
 * With no rows at all the empty state invites the host's Add button. Search or filter the
 * populated table down to nothing instead and the same slot switches to the no-matches copy,
 * with a Clear all that leaves the search term alone.
 */
export const Empty: Story = {
  args: { sharedFolders: [] },
};
