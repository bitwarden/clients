import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { action } from "storybook/actions";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  DialogModule,
  I18nMockService,
  StatusLockupComponent,
} from "@bitwarden/components";

import { SharedFolderRow, SharedFoldersTableRowAction } from "./shared-folders-table-row";
import { SharedFoldersTableComponent } from "./shared-folders-table.component";

const sharedFolders: SharedFolderRow[] = [
  { id: "col-1", name: "Engineering", permissions: "Can manage", items: 42 },
  { id: "col-2", name: "Finance", permissions: "Can edit", items: 8 },
  { id: "col-3", name: "Human resources", permissions: "Can view", items: 0 },
  { id: "col-4", name: "Marketing", permissions: "Can edit, except passwords", items: 17 },
  { id: "col-5", name: "Operations", permissions: "Can view, except passwords", items: 3 },
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

type StoryProps = {
  sharedFolders: SharedFolderRow[];
  loading: boolean;
  rowActions: SharedFoldersTableRowAction[];
};

const template = /* HTML */ `
  <div class="tw-bg-background-alt tw-p-6">
    <vault-shared-folders-table
      [sharedFolders]="sharedFolders"
      [loading]="loading"
      [rowActions]="rowActions"
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
  },
  decorators: [
    moduleMetadata({
      // `DialogModule` for its `DialogService` provider: `bit-table-toolbar` injects it for the
      // small-screen filter dialog. Apps get it from their own module graph; a story has to
      // supply it.
      imports: [ButtonModule, DialogModule, StatusLockupComponent],
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
              items: "Items",
              options: "Options",
              optionsForItem: (name) => `Options for ${name}`,
              selectAllRows: "Select all rows",
              selectRow: "Select row",
              // The table's default empty state
              nothingToShow: "Nothing to show",
              noMatchingItems: "No matching items",
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
 * Permissions, or Items; the search box matches on name; the chip offers each permission label
 * present in the rows, with a faceted count apiece.
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
      permissions: "Can manage",
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

/** An empty `sharedFolders` array, falling back to the table's default empty state. */
export const Empty: Story = {
  args: { sharedFolders: [] },
};

/**
 * Project a `slot="empty"` element to replace the default empty state with copy — and a call to
 * action — of the host's own.
 */
export const CustomEmptyState: Story = {
  args: { sharedFolders: [] },
  render: (args) => ({
    props: { ...args, add: action("add") },
    template: /* HTML */ `
      <div class="tw-bg-background-alt tw-p-6">
        <vault-shared-folders-table
          [sharedFolders]="sharedFolders"
          [rowActions]="rowActions"
          (add)="add()"
        >
          <bit-status-lockup slot="empty">
            <span slot="title">No shared folders yet</span>
            <span slot="description">Share vault items with your team by adding a folder.</span>
            <button slot="button" type="button" bitButton buttonType="primary" (click)="add()">
              Add shared folder
            </button>
          </bit-status-lockup>
        </vault-shared-folders-table>
      </div>
    `,
  }),
};
