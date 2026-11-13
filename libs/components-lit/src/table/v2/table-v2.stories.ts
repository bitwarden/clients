import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import "../../bulk-actions-bar/bulk-action";
import "../../bulk-actions-bar/bulk-actions-bar";
import "../../button/button";
import "../../chips/chip-action/chip-action";
import "../../filter-menu/filter-divider";
import "../../filter-menu/filter-menu";
import "../../filter-menu/filter-option";
import "../../filter-menu/filter-option-divider";
import "../../filter-menu/filter-section";
import "../../filter-menu/filter-toggle";
import { hoverReveal } from "../../hover-reveal/hover-reveal";
import "../../icon/icon";
import "../../icon-button/icon-button";
import "../../icon-tile/icon-tile";
import type { IconTileVariant } from "../../icon-tile/icon-tile";
import { collapseOnScroll } from "../../layout/scroll-collapse";
import "../../layout/layout";
import "../../layout/page";
import { positionFixedWrapper, storyNavState } from "../../navigation/story-helpers";
import "../../input/input";
import "../../popover/popover";
import type { BitPopover } from "../../popover/popover";
import { openPopover, PopoverRef } from "../../popover/popover-ref";
import "../../search/search";
import "../../skeleton/skeleton-text";
import { typography } from "../../typography/typography";

import { cellParts, TableRowGroup, TableV2Column } from "./column";
import {
  COLLECTION_ORGS,
  FOLDERS,
  LONG_LABEL_COLLECTIONS,
  LONG_LABEL_FOLDERS,
  LONG_LABEL_ORG,
  LONG_LABEL_ROWS,
  LongLabelFilters,
  LongLabelRow,
  SEAT_ROWS,
  SeatRow,
  typeLabel,
  VAULT_ITEM_TYPES,
  VAULT_ROWS,
  VaultFilters,
  VaultRow,
  VAULTS,
} from "./story-data";
import type { BitTableToolbar } from "./table-toolbar";
import type { TableRowRange } from "./table-v2";
import "./table-paginator";
import "./table-toolbar";
import "./table-v2";

type DemoRow = { id: number; name: string; other: string };
type UsersRow = { id: number; name: string; email: string; starred: boolean };

export default {
  title: "Component Library/Table V2 (Beta)",
  decorators: [(story) => html`<div class="tw-p-4">${story()}</div>`],
} satisfies Meta;

type Story = StoryObj;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Waits for the element and its Lit descendants (across shadow roots) to settle. */
async function settle(el: Element | null | undefined) {
  await customElements.whenDefined("bit-table-v2");
  for (let i = 0; i < 3; i++) {
    await (el as Partial<LitElement> | null)?.updateComplete;
    await nextFrame();
  }
}

const rows = (count: number): DemoRow[] =>
  [...Array(count).keys()].map((i) => ({ id: i, name: `name-${i}`, other: `other-${i}` }));

const basicData = rows(5);

const sparseData: DemoRow[] = [
  { id: 0, name: "name-0", other: "other-0" },
  { id: 1, name: "", other: "other-1" },
  { id: 2, name: "name-2", other: "" },
  { id: 3, name: "", other: "" },
];

const sortFn = (a: DemoRow, b: DemoRow) => a.id - b.id;

const idColumn: TableV2Column<DemoRow> = { name: "id", header: "Id", cell: (row) => row.id };
const nameColumn: TableV2Column<DemoRow> = {
  name: "name",
  header: "Name",
  cell: (row) => row.name,
};
const otherColumn: TableV2Column<DemoRow> = {
  name: "other",
  header: "Other",
  cell: (row) => row.other,
};

const sortableColumns: TableV2Column<DemoRow>[] = [
  { ...idColumn, sortable: true, defaultSort: "asc" },
  { ...nameColumn, sortable: true },
  { ...otherColumn, sortable: true, sortFn },
];

const plainColumns = [idColumn, nameColumn, otherColumn];

export const Default: Story = {
  render: () => html`<bit-table-v2 .data=${basicData} .columns=${sortableColumns}></bit-table-v2>`,
};

const vaultName = (id: string) => VAULTS.find((v) => v.id === id)?.name ?? id;

const vaultColumns: TableV2Column<VaultRow>[] = [
  { name: "name", header: "Name", sortable: true, defaultSort: "asc", cell: (row) => row.name },
  { name: "type", header: "Type", sortable: true, width: "150px", cell: (r) => typeLabel(r.type) },
  { name: "vault", header: "Vault", width: "160px", cell: (row) => vaultName(row.vault) },
];

const vaultFilter = (row: VaultRow, f: Partial<VaultFilters>) =>
  (!f.search || row.name.toLowerCase().includes(f.search.toLowerCase())) &&
  (f.type == null || row.type === f.type) &&
  (!f.vault?.length || f.vault.includes(row.vault)) &&
  (!f.collection?.length || f.collection.some((c) => row.collectionIds.includes(c))) &&
  // `null` is a real selection here ("No folders"), so match on it rather than skip it.
  (!f.folder?.length || f.folder.includes(row.folderId)) &&
  (!f.favorite || row.favorite);

const typeChip = html`<bit-filter-menu key="type" placeholder-text="Type" unset-label="All">
  ${VAULT_ITEM_TYPES.map(
    (option) => html`<bit-filter-option .value=${option.value}>${option.label}</bit-filter-option>`,
  )}
</bit-filter-menu>`;

const vaultChip = html`<bit-filter-menu
  icon="bwi-vault"
  key="vault"
  placeholder-text="Vault"
  multiple
>
  ${VAULTS.map(
    (vault) => html`<bit-filter-option .value=${vault.id}>${vault.name}</bit-filter-option>`,
  )}
</bit-filter-menu>`;

const favoriteToggle = html`<bit-filter-toggle
  key="favorite"
  label="Favorites"
  icon="bwi-star"
  icon-active="bwi-star-f"
></bit-filter-toggle>`;

type Collection = { id: string; name: string; children?: Collection[] };

const collectionTile = { icon: "bwi-shared-folder", variant: "brand" } as const;

/** Nested collection options; `tiles` adds an icon tile and expands every parent. */
const collectionOptions = (collections: readonly Collection[], tiles: boolean): TemplateResult[] =>
  collections.map(
    (collection) =>
      html`<bit-filter-option
        .value=${collection.id}
        .iconTile=${tiles ? collectionTile : undefined}
        ?expanded=${tiles && !!collection.children?.length}
        >${collection.name}${collectionOptions(collection.children ?? [], tiles)}</bit-filter-option
      >`,
  );

const sharedFoldersChip = (tiles: boolean, nested = true) =>
  html`<bit-filter-menu
    icon="bwi-shared-folder"
    key="collection"
    placeholder-text="Shared folders"
    multiple
  >
    ${COLLECTION_ORGS.map(
      (org) =>
        html`<bit-filter-section label=${org.name} ?collapsible=${nested}>
          ${
            nested
              ? collectionOptions(org.collections as Collection[], tiles)
              : org.collections.map(
                  (c) => html`<bit-filter-option .value=${c.id}>${c.name}</bit-filter-option>`,
                )
          }
        </bit-filter-section>`,
    )}
  </bit-filter-menu>`;

const folderTile = (variant: IconTileVariant) => ({ icon: "bwi-tag", variant }) as const;

const foldersChip = html`<bit-filter-menu
  icon="bwi-folder"
  key="folder"
  placeholder-text="My folders"
  multiple
>
  <bit-filter-option .value=${null}>No folders</bit-filter-option>
  <bit-filter-option-divider></bit-filter-option-divider>
  ${FOLDERS.map(
    (folder) =>
      html`<bit-filter-option .value=${folder.id} .iconTile=${folderTile(folder.variant)}
        >${folder.name}</bit-filter-option
      >`,
  )}
</bit-filter-menu>`;

/**
 * Filtering with the form-group model: each chip declares a `key`, owns its own selection, and
 * the table collects them into `table.filterValues` (a `{ key: value }` object) for its `filter`.
 */
const filterableTable = (presentation: "table" | "list" = "table") => html`
  <bit-table-v2
    .data=${VAULT_ROWS}
    .columns=${vaultColumns}
    .filter=${vaultFilter}
    presentation=${presentation}
  >
    <bit-table-toolbar>
      <bit-search placeholder="Search" aria-label="Search"></bit-search>
      <bit-button button-type="primary" slot="end">New</bit-button>
      ${typeChip}
      <bit-filter-divider></bit-filter-divider>
      ${vaultChip} ${sharedFoldersChip(false)} ${favoriteToggle}
    </bit-table-toolbar>
  </bit-table-v2>
`;

/**
 * `presentation` switches between the bordered column grid (`table`) and a card list (`list`).
 * Reuses the {@link Filterable} demo so the filtering chrome carries over unchanged.
 */
export const List: StoryObj<{ presentation: "table" | "list" }> = {
  args: { presentation: "list" },
  argTypes: { presentation: { control: "inline-radio", options: ["table", "list"] } },
  render: (args) => filterableTable(args.presentation),
};

export const CustomCell: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${basicData}
      .columns=${
        [
          { ...idColumn, width: "80px" },
          nameColumn,
          { name: "other", header: "Link", cell: (row) => html`<a href="#">${row.other} →</a>` },
        ] satisfies TableV2Column<DemoRow>[]
      }
    ></bit-table-v2>`,
};

/**
 * `width` sets the column's grid track. Use content-independent values so columns align across
 * every row: a fixed length, `1fr` (the default), or `minmax(min, max)`.
 */
export const ColumnSizing: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${basicData}
      .columns=${
        [
          { ...idColumn, header: "Id (80px)", width: "80px" },
          { ...nameColumn, header: "Name (1fr)" },
          { ...otherColumn, header: "Other (minmax)", width: "minmax(120px, 200px)" },
        ] satisfies TableV2Column<DemoRow>[]
      }
    ></bit-table-v2>`,
};

const users: UsersRow[] = [
  { id: 1, name: "Alex Johnson", email: "alex@example.com", starred: true },
  { id: 2, name: "Sam Rivera", email: "sam.rivera@example.com", starred: false },
  { id: 3, name: "Jordan Park", email: "jordan.park@example.com", starred: true },
];

/**
 * Rich cells return `cellParts({ start, content, secondary, end })`: a leading icon/tile, the
 * title, a subtitle, and a trailing affordance.
 */
export const RichCells: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${users}
      .columns=${
        [
          {
            name: "name",
            header: "Name",
            sortable: true,
            defaultSort: "asc",
            cell: (row) =>
              cellParts({
                start: html`<bit-icon-tile icon="bwi-globe" size="sm"></bit-icon-tile>`,
                content: row.name,
                secondary: row.email,
                end: row.starred
                  ? html`<i class="bwi bwi-star-f tw-text-warning" aria-hidden="true"></i>`
                  : undefined,
              }),
          },
          {
            name: "email",
            header: html`<i class="bwi bwi-envelope tw-me-1" aria-hidden="true"></i> Contact`,
            cell: (row) => cellParts({ content: row.email, secondary: `User #${row.id}` }),
          },
        ] satisfies TableV2Column<UsersRow>[]
      }
    ></bit-table-v2>`,
};

export const CellFocusRings: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${users}
      virtual-row-height="48"
      height="5"
      .columns=${
        [
          {
            name: "name",
            header: "Name",
            cell: (row) =>
              html`<bit-chip-action
                size="small"
                label=${`${row.name} with a name long enough to truncate`}
                class="tw-test-focus-visible"
              ></bit-chip-action>`,
          },
          {
            name: "email",
            header: "Actions",
            cell: () =>
              html`<bit-icon-button
                icon="bwi-ellipsis-v"
                size="small"
                label="Options"
                class="tw-test-focus-visible"
              ></bit-icon-button>`,
          },
        ] satisfies TableV2Column<UsersRow>[]
      }
    ></bit-table-v2>`,
};

/** Each row is a hover-reveal container, so `hoverReveal()` actions show on row hover or focus. */
export const HoverReveal: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${users}
      .columns=${
        [
          { name: "name", header: "Name", cell: (row) => row.name },
          {
            name: "email",
            header: html`<span class="tw-sr-only">Actions</span>`,
            width: "72px",
            cell: (row) =>
              cellParts({
                end: html`<bit-icon-button
                  ${hoverReveal()}
                  icon="bwi-pencil-square"
                  size="small"
                  label=${`Edit ${row.name}`}
                ></bit-icon-button>`,
              }),
          },
        ] satisfies TableV2Column<UsersRow>[]
      }
    ></bit-table-v2>`,
};

export const EmptyCells: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${sparseData}
      .columns=${
        [
          {
            name: "name",
            header: "Name",
            cell: (row) =>
              cellParts({
                start: html`<bit-icon-tile icon="bwi-globe" size="sm"></bit-icon-tile>`,
                content: row.name,
              }),
          },
          otherColumn,
        ] satisfies TableV2Column<DemoRow>[]
      }
    ></bit-table-v2>`,
};

/**
 * `displayedColumns` sets display order; columns it omits aren't rendered even though they're
 * declared. Here `other` is declared but left out.
 */
export const ReorderedAndHidden: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${basicData}
      .columns=${[idColumn, nameColumn, { ...otherColumn, header: "Hidden" }]}
      .displayedColumns=${["name", "id"]}
    ></bit-table-v2>`,
};

/** A table that opts two of its three columns into the Customize dialog. */
const customizeColumnsTable = () =>
  html`<bit-table-v2
    .data=${basicData}
    state-key="vaultItems"
    .columns=${
      [
        { ...nameColumn, sortable: true },
        { ...idColumn, removable: true, label: "Id", sortable: true },
        { ...otherColumn, removable: true, label: "Other", sortable: true },
      ] satisfies TableV2Column<DemoRow>[]
    }
  >
    <bit-table-toolbar>
      <bit-search placeholder="Search"></bit-search>
      <bit-button button-type="secondary" slot="end" start-icon="bwi-download">Import</bit-button>
      <bit-button button-type="primary" slot="end" start-icon="bwi-plus">Add</bit-button>
    </bit-table-toolbar>
  </bit-table-v2>`;

/** The toolbar's Customize button, inside its shadow root. */
async function customizeButton(canvasElement: HTMLElement): Promise<HTMLElement> {
  const toolbar = canvasElement.querySelector<BitTableToolbar>("bit-table-toolbar")!;
  await settle(toolbar);
  return toolbar.shadowRoot!.querySelector<HTMLElement>("[data-testid=customize-columns]")!;
}

/** The open dialog's switches, by label. */
async function dialogSwitch(label: string): Promise<HTMLElement | undefined> {
  const dialog = document.querySelector("bit-customize-columns-dialog");
  await settle(dialog);
  return Array.from(
    dialog?.querySelectorAll<HTMLElement & { label: string }>("bit-switch") ?? [],
  ).find((s) => s.label === label);
}

/** Turns the named columns off through the Customize dialog, then closes it. */
async function hideColumns(canvasElement: HTMLElement, ...labels: string[]) {
  (await customizeButton(canvasElement)).click();
  for (const label of labels) {
    (await dialogSwitch(label))?.click();
  }
  document.querySelector<HTMLElement>("bit-customize-columns-dialog [data-done]")?.click();
}

/**
 * A table opts into the column picker by setting `state-key` and marking the columns the user
 * may hide. The **Customize** button then appears beside the search input, and each switch in the
 * dialog applies immediately.
 *
 * **Import** and **Add** are the host's own page controls, projected through `slot="end"`.
 * Customize belongs to the table, so it sits to their left.
 */
export const CustomizeColumns: Story = {
  render: customizeColumnsTable,
};

const boundedWidthsTable = () =>
  html`<bit-table-v2
    .data=${VAULT_ROWS}
    state-key="vaultItems"
    .columns=${
      [
        {
          name: "name",
          header: "Name",
          sortable: true,
          defaultSort: "asc",
          width: "minmax(240px, 480px)",
          cell: (row) => row.name,
        },
        {
          name: "vault",
          header: "Vault",
          removable: true,
          label: "Vault",
          sortable: true,
          width: "minmax(176px, 280px)",
          cell: (row) => vaultName(row.vault),
        },
        {
          name: "type",
          header: "Type",
          removable: true,
          label: "Type",
          sortable: true,
          width: "minmax(176px, 280px)",
          cell: (row) => typeLabel(row.type),
        },
        {
          name: "folderId",
          header: "Folders",
          removable: true,
          label: "Folders",
          sortable: true,
          width: "minmax(140px, 1fr)",
          cell: (row) => FOLDERS.find((f) => f.id === row.folderId)?.name ?? "—",
        },
        {
          name: "actions",
          header: html`<span class="tw-sr-only">Options</span>`,
          width: "160px",
          cell: () =>
            cellParts({
              end: html`<bit-icon-button
                icon="bwi-ellipsis-v"
                size="small"
                label="Options"
              ></bit-icon-button>`,
            }),
        },
      ] satisfies TableV2Column<VaultRow, "actions">[]
    }
  >
    <bit-table-toolbar>
      <bit-search placeholder="Search"></bit-search>
    </bit-table-toolbar>
  </bit-table-v2>`;

/**
 * Every column has a bounded max except **Folders**, which supplies the row's only flexible
 * track. Compare with {@link CustomizeColumnsBoundedWidthsHidden}.
 */
export const CustomizeColumnsBoundedWidths: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  render: boundedWidthsTable,
};

/**
 * The same table with **Folders** hidden. Nothing declared can grow, so the table frees the first
 * column's max — Name stretches and Options stays flush with the row's right edge.
 */
export const CustomizeColumnsBoundedWidthsHidden: Story = {
  render: boundedWidthsTable,
  play: ({ canvasElement }) => hideColumns(canvasElement, "Folders"),
};

/** Everything hideable turned off, leaving only Name and the non-removable Options column. */
export const CustomizeColumnsBoundedWidthsAllHidden: Story = {
  render: boundedWidthsTable,
  play: ({ canvasElement }) => hideColumns(canvasElement, "Vault", "Type", "Folders"),
};

/** The dialog as it opens, with one switch per hideable column. */
export const CustomizeColumnsDialogOpen: Story = {
  render: customizeColumnsTable,
  play: async ({ canvasElement }) => (await customizeButton(canvasElement)).click(),
};

/** A reusable column: a function returning a column definition, shared across tables. */
const statusColumn = (): TableV2Column<DemoRow> => ({
  name: "other",
  header: "Status",
  sortable: true,
  cell: (row) =>
    html`<span class="tw-rounded tw-bg-bg-brand-soft tw-px-2 tw-py-0.5 tw-text-xs"
      >${row.other}</span
    >`,
});

/**
 * Columns compose like any other data: here `statusColumn()` comes from a reusable helper (the
 * Angular wrapper-component pattern).
 */
export const WrappedColumn: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${basicData}
      .columns=${[idColumn, { ...nameColumn, sortable: true }, statusColumn()]}
    ></bit-table-v2>`,
};

const largeData = rows(100);
const trackById = (_: number, row: { id: number }) => row.id;

export const Scrollable: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${largeData}
      .columns=${sortableColumns}
      .trackBy=${trackById}
      virtual-row-height="64"
      height="6"
    ></bit-table-v2>`,
};

type GroupedRow = { id: number; name: string; type: "login" | "card" | "note" };

const GROUP_TYPES = ["login", "card", "note"] as const;

const groupedData: GroupedRow[] = [...Array(90).keys()].map((i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  type: GROUP_TYPES[i % 3],
}));

const groupedColumns: TableV2Column<GroupedRow>[] = [
  { name: "name", header: "Name", sortable: true, defaultSort: "asc", cell: (row) => row.name },
];

const typeGroups = (cardsCollapsed = false): TableRowGroup<GroupedRow>[] => [
  { id: "login", header: "Logins", collapsible: true, match: (row) => row.type === "login" },
  {
    id: "card",
    header: "Cards",
    collapsible: true,
    collapsed: cardsCollapsed,
    match: (row) => row.type === "card",
  },
  { id: "note", header: "Notes", collapsible: true, match: (row) => row.type === "note" },
];

/**
 * Grouping composes with virtualization: group headers and rows share one virtualized list,
 * positioned from their (differing) fixed heights. Groups are a `list`-presentation feature;
 * collapsing one drops its rows from the list.
 */
export const GroupedVirtualized: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${groupedData}
      .columns=${groupedColumns}
      .groups=${typeGroups()}
      .trackBy=${trackById}
      presentation="list"
      virtual-row-height="48"
      height="8"
    ></bit-table-v2>`,
};

/**
 * A group's `collapsed` seeds its initial state — here "Cards" starts collapsed. Persist user
 * toggles by listening to `groupToggle`.
 */
export const GroupedInitiallyCollapsed: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${groupedData}
      .columns=${groupedColumns}
      .groups=${typeGroups(true)}
      .trackBy=${trackById}
      presentation="list"
      virtual-row-height="48"
      height="8"
    ></bit-table-v2>`,
};

/**
 * `description` renders explanatory text under a group's header. Pair it with
 * `hideOnEmpty: false` to keep the group on screen when no rows match. Empty groups otherwise
 * auto-hide, as "Cards" does here.
 */
export const GroupedDescription: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${[...Array(6).keys()].map((i) => ({
        id: i + 1,
        name: `Note ${i + 1}`,
        type: "note" as const,
      }))}
      .columns=${[{ name: "name", header: "Name", cell: (row: GroupedRow) => row.name }]}
      .groups=${
        [
          {
            id: "autofill",
            header: "Autofill suggestions",
            match: (row) => row.type === "login",
            hideOnEmpty: false,
            description: "Save a login item for this site to autofill",
          },
          { id: "card", header: "Cards", match: (row) => row.type === "card" },
          { id: "note", header: "Notes", match: (row) => row.type === "note" },
        ] satisfies TableRowGroup<GroupedRow>[]
      }
      presentation="list"
      virtual-row-height="48"
      height="8"
    ></bit-table-v2>`,
};

type WideRow = {
  id: number;
  name: string;
  email: string;
  department: string;
  role: string;
  location: string;
  status: string;
  updated: string;
};

const wideData: WideRow[] = [...Array(50).keys()].map((i) => ({
  id: i + 1,
  name: `Person ${i + 1}`,
  email: `person${i + 1}@example.com`,
  department: ["Engineering", "Design", "Support", "Sales"][i % 4],
  role: ["Member", "Admin", "Owner"][i % 3],
  location: ["Remote", "New York", "Berlin", "Tokyo"][i % 4],
  status: i % 2 === 0 ? "Active" : "Invited",
  updated: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`,
}));

const wideColumn = (
  name: keyof WideRow,
  header: string,
  width: string,
  extra: Partial<TableV2Column<WideRow>> = {},
): TableV2Column<WideRow> => ({ name, header, width, cell: (row) => row[name], ...extra });

/**
 * Fixed-width columns whose combined width exceeds the table, in a width-capped container. The
 * header row and body are synced horizontal scroll containers, so scrolling either keeps the
 * columns aligned while the header stays pinned vertically.
 */
export const ManyColumns: Story = {
  render: () =>
    html`<div class="tw-max-w-3xl">
      <bit-table-v2
        .data=${wideData}
        virtual-row-height="48"
        height="8"
        .columns=${[
          wideColumn("id", "Id", "64px"),
          wideColumn("name", "Name", "200px", { sortable: true, defaultSort: "asc" }),
          wideColumn("email", "Email", "240px"),
          wideColumn("department", "Department", "160px", { sortable: true }),
          wideColumn("role", "Role", "140px"),
          wideColumn("location", "Location", "160px"),
          wideColumn("status", "Status", "140px", { sortable: true }),
          wideColumn("updated", "Updated", "160px", { sortable: true }),
        ]}
      ></bit-table-v2>
    </div>`,
};

/** A full-height page body: a bounded flex column, as `bit-page` provides in Angular. */
const page = (content: unknown) =>
  positionFixedWrapper(
    html`<bit-layout .sideNavState=${storyNavState()}>
      <bit-page>${content}</bit-page>
    </bit-layout>`,
    false,
  );

/**
 * `height="fill"` makes the table grow to its container's height and scroll internally, instead
 * of sizing to content. Compare with `Scrollable`, which caps the body at a row count.
 */
export const FillPage: Story = {
  render: () =>
    page(
      html`<h1 class="${typography("h1")} tw-mb-4">Members</h1>
        <bit-table-v2
          .data=${largeData}
          .columns=${
            [
              { ...idColumn, sortable: true, defaultSort: "asc" },
              { ...nameColumn, sortable: true },
              otherColumn,
            ] satisfies TableV2Column<DemoRow>[]
          }
          .trackBy=${trackById}
          virtual-row-height="64"
          height="fill"
        ></bit-table-v2>`,
    ),
};

/**
 * With `scroll-layout-host`, a `fill` table's body becomes the page's scroll region, so layout
 * behaviors follow it: here the toolbar uses
 * `collapseOnScroll()` to collapse while scrolling down, and draws the page's seam in place of its
 * own border.
 */
export const FillPageCollapsingToolbar: Story = {
  render: () =>
    page(
      html`<h1 class="${typography("h1")} tw-mb-4">Members</h1>
        <bit-table-v2
          .data=${largeData}
          .columns=${[idColumn, nameColumn, otherColumn]}
          .trackBy=${trackById}
          virtual-row-height="64"
          height="fill"
          scroll-layout-host
        >
          <bit-table-toolbar ${collapseOnScroll({})}>
            <bit-search placeholder="Search" aria-label="Search"></bit-search>
            <bit-button button-type="primary" slot="end">New</bit-button>
          </bit-table-toolbar>
        </bit-table-v2>`,
    ),
};

@customElement("story-fill-resized-viewport")
class StoryFillResizedViewport extends LitElement {
  @state() private blockShown = true;

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  protected render() {
    return page(
      html`<div class="tw-mb-4 tw-flex tw-items-center tw-gap-4">
          <h1 class="${typography("h1")} tw-mb-0">Members</h1>
          <bit-button @click=${() => (this.blockShown = !this.blockShown)}
            >${this.blockShown ? "Hide" : "Show"} block</bit-button
          >
        </div>
        ${
          this.blockShown
            ? html`<div
                class="tw-mb-4 tw-flex tw-h-96 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-bg-secondary"
              >
                Content above the table
              </div>`
            : nothing
        }
        <bit-table-v2
          .data=${largeData}
          .columns=${[idColumn, nameColumn]}
          .trackBy=${trackById}
          virtual-row-height="64"
          height="fill"
        ></bit-table-v2>`,
    );
  }
}

/**
 * A `fill` table whose viewport grows without the window resizing: hiding the block above it
 * hands its height to the table. Rows must still reach the bottom edge afterwards.
 */
export const FillPageResizedViewport: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => html`<story-fill-resized-viewport></story-fill-resized-viewport>`,
};

/**
 * A crowded `fill` table keeps a minimum height instead of shrinking, and the frame scrolls to
 * reach it. The header keeps its full height; the empty state scrolls beneath it.
 */
export const FillCrowdedEmpty: Story = {
  render: () =>
    html`<div class="tw-flex tw-flex-col tw-overflow-auto" style="height: 480px">
      <div
        class="tw-mb-4 tw-flex tw-h-96 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-bg-secondary"
      >
        Content above the table
      </div>
      <bit-table-v2 .data=${[]} .columns=${[idColumn, nameColumn]} height="fill"></bit-table-v2>
    </div>`,
};

/**
 * Filtering with filter chips. Chips register with the table automatically; the table composes
 * their values into `filter` and shows a "no matching items" state when they exclude everything.
 */
export const Filterable: Story = {
  render: () => filterableTable(),
};

@customElement("story-filter-coachmark-table")
class StoryFilterCoachmarkTable extends LitElement {
  @state() private filterDialogOpen = false;

  private ref?: PopoverRef;

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  private get toolbar() {
    return this.querySelector<BitTableToolbar>("bit-table-toolbar")!;
  }

  private coachmark(id: string) {
    return this.querySelector<BitPopover>(`#${id}`)!;
  }

  private start() {
    this.ref?.close();
    this.ref = openPopover(this.coachmark("filters-coachmark"), this.toolbar.filterButton, {
      spotlight: true,
      position: "below-end",
    });
  }

  private next() {
    this.ref?.close();
    this.filterDialogOpen = true;
    // A getter: the dialog row only exists once the dialog renders and finishes animating in.
    this.ref = openPopover(
      this.coachmark("vault-row-coachmark"),
      () => this.toolbar.filterRow("vault"),
      {
        spotlight: true,
        position: "above-center",
      },
    );
  }

  private endTour() {
    this.ref?.close();
    this.ref = undefined;
    this.filterDialogOpen = false;
  }

  protected render() {
    // Popup-sized: the chips can't fit, so the toolbar shows the filter button at any viewport.
    return html`<div class="tw-flex tw-flex-col" style="width: 380px; height: 600px">
        <bit-table-v2
          .data=${VAULT_ROWS}
          .columns=${[vaultColumns[0]]}
          .filter=${vaultFilter}
          presentation="list"
          height="fill"
        >
          <bit-table-toolbar
            ?filter-dialog-open=${this.filterDialogOpen}
            @filterDialogOpenChange=${(e: CustomEvent<boolean>) => {
              this.filterDialogOpen = e.detail;
              if (!e.detail) {
                this.endTour();
              }
            }}
          >
            <bit-search placeholder="Search" aria-label="Search"></bit-search>
            <bit-button button-type="primary" slot="end" @click=${() => this.start()}
              >Start tour</bit-button
            >
            ${typeChip} ${vaultChip} ${sharedFoldersChip(false, false)} ${favoriteToggle}
          </bit-table-toolbar>
        </bit-table-v2>
      </div>

      <bit-popover id="filters-coachmark" heading="Filters" @closed=${() => this.endTour()}>
        <div>Narrow the list by type or vault.</div>
        <div class="tw-mt-4">
          <bit-button button-type="primary" @click=${() => this.next()}>Next</bit-button>
        </div>
      </bit-popover>
      <bit-popover id="vault-row-coachmark" heading="Vaults" @closed=${() => this.endTour()}>
        <div>Show items from one vault at a time.</div>
        <div class="tw-mt-4">
          <bit-button button-type="primary" @click=${() => this.endTour()}>Done</bit-button>
        </div>
      </bit-popover>`;
  }
}

/**
 * Coachmarks pointing into the toolbar: the filter button, then a row inside the filter dialog,
 * spotlit above the dialog.
 */
export const FilterCoachmarkTour: Story = {
  render: () => html`<story-filter-coachmark-table></story-filter-coachmark-table>`,
  // Popover positioning is flaky in snapshots, see CL-822
  parameters: { chromatic: { disableSnapshot: true } },
};

/**
 * A toolbar `rangeLabel` for the demos: "1–10 of 39 items", with the empty and single-row cases
 * worded on their own. A real consumer builds this from i18n messages.
 */
const itemRangeLabel = ({ start, end, total }: TableRowRange) => {
  if (total === 0) {
    return "0 items";
  }
  if (total === 1) {
    return "1 item";
  }
  return `${start}–${end} of ${total} items`;
};

const kitchenSinkTable = () =>
  html`<bit-table-v2 .data=${VAULT_ROWS} .columns=${vaultColumns} .filter=${vaultFilter}>
    <bit-table-toolbar .rangeLabel=${itemRangeLabel}>
      <bit-search placeholder="Search" aria-label="Search"></bit-search>
      <bit-button button-type="secondary" slot="end" start-icon="bwi-download">Import</bit-button>
      <bit-button button-type="primary" slot="end" start-icon="bwi-plus">Add</bit-button>
      ${typeChip}
      <bit-filter-divider></bit-filter-divider>
      ${vaultChip} ${sharedFoldersChip(true)} ${foldersChip} ${favoriteToggle}
    </bit-table-toolbar>
    <bit-table-paginator page-size="5" .pageSizeOptions=${[5, 10, 25]}></bit-table-paginator>
  </bit-table-v2>`;

/** Finds the first match for `selector` anywhere under `root`, including inside shadow roots. */
function deepQuery<E extends Element>(root: ParentNode, selector: string): E | undefined {
  const direct = root.querySelector<E>(selector);
  if (direct) {
    return direct;
  }
  for (const el of Array.from(root.querySelectorAll("*"))) {
    const found = el.shadowRoot && deepQuery<E>(el.shadowRoot, selector);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Opens the Shared folders filter, whichever surface the toolbar is showing: the chip's popover
 * when wide, or the collapsed trigger's dialog drilled into Shared folders when narrow.
 */
async function openSharedFoldersFilter(canvasElement: HTMLElement) {
  const toolbar = canvasElement.querySelector<BitTableToolbar>("bit-table-toolbar")!;
  await settle(toolbar);
  const trigger = toolbar.filterButton;
  if (!trigger) {
    const chip = canvasElement.querySelector<HTMLElement & { ariaTarget?: HTMLElement }>(
      "bit-filter-menu[key=collection]",
    );
    chip?.ariaTarget?.click();
    await settle(chip);
    return;
  }
  trigger.click();
  await settle(toolbar);
  await new Promise((resolve) => setTimeout(resolve, 300));
  toolbar.filterRow("collection")?.click();
  await settle(document.querySelector("bit-filter-dialog"));
}

/** Searches the open filter surface for a term nothing matches. */
async function searchForNothing(canvasElement: HTMLElement) {
  const dialog = document.querySelector("bit-filter-dialog");
  const scope: ParentNode =
    dialog ?? canvasElement.querySelector("bit-filter-menu[key=collection]")!.shadowRoot!;
  const search = deepQuery<HTMLElement & { value: string }>(scope, "[data-filter-search]");
  if (search) {
    search.value = "zzz";
    search.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }
}

/**
 * The toolbar at full stretch: search, every kind of filter chip, `slot=end` action buttons, a
 * range label, and a paginator. On a narrow toolbar the chip row collapses into the filter dialog
 * and the action buttons take a full-width row of their own, split evenly.
 */
export const KitchenSink: Story = {
  render: kitchenSinkTable,
};

/**
 * The Shared folders filter open, nested three levels deep with an icon tile on every row: the
 * chip's popover on a wide toolbar, and the responsive dialog's drill-in on a narrow one.
 */
export const KitchenSinkFilterOpen: Story = {
  render: kitchenSinkTable,
  play: ({ canvasElement }) => openSharedFoldersFilter(canvasElement),
  parameters: { chromatic: { viewports: [390, 1280] } },
};

/** The same filter searched for a term nothing matches, so the no-results state renders. */
export const KitchenSinkFilterEmpty: Story = {
  render: kitchenSinkTable,
  play: async ({ canvasElement }) => {
    await openSharedFoldersFilter(canvasElement);
    await searchForNothing(canvasElement);
  },
  parameters: { chromatic: { viewports: [390, 1280] } },
};

const longLabelFilter = (row: LongLabelRow, f: Partial<LongLabelFilters>) =>
  (!f.search || row.name.toLowerCase().includes(f.search.toLowerCase())) &&
  (!f.collection?.length || f.collection.some((c) => row.collectionIds.includes(c))) &&
  (!f.folder?.length || f.folder.includes(row.folderId));

/**
 * Filter options named after real organizations, collections, and folders — long enough that
 * every surface has to truncate them. `applied` seeds a selection.
 */
const longLabelTable = (applied: boolean) =>
  html`<bit-table-v2
    .data=${LONG_LABEL_ROWS}
    .columns=${[{ name: "name", header: "Name", sortable: true, defaultSort: "asc", cell: (row: LongLabelRow) => row.name }]}
    .filter=${longLabelFilter}
    .filters=${applied ? { collection: LONG_LABEL_COLLECTIONS.map((c) => c.id) } : {}}
  >
    <bit-table-toolbar>
      <bit-search placeholder="Search" aria-label="Search"></bit-search>
      <bit-filter-menu
        key="collection"
        placeholder-text="Shared folders"
        icon="bwi-shared-folder"
        multiple
      >
        <bit-filter-section label=${LONG_LABEL_ORG} collapsible>
          ${LONG_LABEL_COLLECTIONS.map(
            (c) => html`<bit-filter-option .value=${c.id}>${c.name}</bit-filter-option>`,
          )}
        </bit-filter-section>
      </bit-filter-menu>
      <bit-filter-menu icon="bwi-folder" key="folder" placeholder-text="My folders" multiple>
        ${LONG_LABEL_FOLDERS.map(
          (f) => html`<bit-filter-option .value=${f.id}>${f.name}</bit-filter-option>`,
        )}
      </bit-filter-menu>
    </bit-table-toolbar>
  </bit-table-v2>`;

/**
 * Long option names, with a selection already applied. Each surface truncates and carries a
 * tooltip with the whole thing: the chip triggers, and on a narrow toolbar the dismissible chips
 * on its collapsed row — one per selected option, so each can be dropped without clearing the
 * rest.
 */
export const FilterLongLabelsApplied: Story = {
  render: () => longLabelTable(true),
  parameters: { chromatic: { viewports: [390, 1280] } },
};

/** The same filters opened: the popover's rows on a wide toolbar, the dialog's row list on a narrow one. */
export const FilterLongLabelsOpen: Story = {
  render: () => longLabelTable(true),
  play: ({ canvasElement }) => openSharedFoldersFilter(canvasElement),
  parameters: { chromatic: { viewports: [390, 1280] } },
};

/**
 * Search with no filter chips. A `bit-search` inside the table registers the `search` key the same
 * way a chip registers its own, so `filter` just reads `f.search`.
 */
export const Searchable: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${VAULT_ROWS}
      .columns=${vaultColumns}
      .filter=${(row: VaultRow, f: { search?: string }) =>
        !f.search || row.name.toLowerCase().includes(f.search.toLowerCase())}
    >
      <bit-table-toolbar>
        <bit-search placeholder="Search" aria-label="Search"></bit-search>
        <bit-button button-type="primary" slot="end">New</bit-button>
      </bit-table-toolbar>
    </bit-table-v2>`,
};

@customElement("story-url-sync-table")
class StoryUrlSyncTable extends LitElement {
  @state() private url = window.location.search;

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  private readonly refresh = () => {
    // The table writes the URL after its own update; read it on the next frame.
    requestAnimationFrame(() => (this.url = window.location.search));
  };

  protected render() {
    return html`<p class="tw-mb-2 tw-font-mono tw-text-sm tw-text-fg-heading tw-break-all">
        ${decodeURIComponent(this.url)}
      </p>
      <bit-table-v2
        .data=${VAULT_ROWS}
        .columns=${vaultColumns}
        .filter=${vaultFilter}
        query-param="items"
        @input=${this.refresh}
        @filterChange=${this.refresh}
        @sortChange=${this.refresh}
        @pageIndexChange=${this.refresh}
        @pageSizeChange=${this.refresh}
      >
        <bit-table-toolbar>
          <bit-search placeholder="Search" aria-label="Search"></bit-search>
          ${typeChip} ${vaultChip} ${favoriteToggle}
        </bit-table-toolbar>
        <bit-table-paginator page-size="5" .pageSizeOptions=${[5, 10, 25]}></bit-table-paginator>
      </bit-table-v2>`;
  }
}

/**
 * `query-param` syncs filters, sort, and pagination to the URL under that namespace, so a
 * filtered/sorted view is shareable and survives a reload. The live query string is shown above
 * the table (it's the preview iframe's URL).
 */
export const UrlSync: Story = {
  render: () => html`<story-url-sync-table></story-url-sync-table>`,
};

const noop = () => {
  /* story noop */
};

/**
 * Configuring `selection` prepends a checkbox column. A `bit-bulk-actions-bar` placed inside the
 * table gets its `selected-count` from the selection, and its Clear button clears it — no wiring
 * needed.
 */
export const WithBulkActions: Story = {
  render: () =>
    html`<bit-table-v2 .data=${basicData} .columns=${plainColumns} .selection=${{ multiple: true }}>
      <bit-bulk-actions-bar>
        <bit-bulk-action .action=${noop} icon="bwi-folder" label="Move"></bit-bulk-action>
        <bit-bulk-action .action=${noop} icon="bwi-archive" label="Archive"></bit-bulk-action>
        <bit-bulk-action .action=${noop} icon="bwi-trash" label="Delete"></bit-bulk-action>
        <bit-bulk-additional-action
          .action=${noop}
          icon="bwi-upload"
          label="Export"
        ></bit-bulk-additional-action>
      </bit-bulk-actions-bar>
    </bit-table-v2>`,
  play: async ({ canvasElement }) => {
    // Check the header "select all" box so the bulk actions bar is shown.
    const table = canvasElement.querySelector("bit-table-v2")!;
    await settle(table);
    table.shadowRoot!.querySelector<HTMLElement>("[role=columnheader] bit-checkbox")?.click();
  },
};

/**
 * `selection: { multiple: true }` prepends a checkbox column. The header checkbox selects all
 * currently-filtered rows; row checkboxes toggle individually.
 */
export const Selectable: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${basicData}
      .columns=${plainColumns}
      .selection=${{ multiple: true }}
    ></bit-table-v2>`,
};

/**
 * A `canSelect` predicate makes only some rows selectable. Non-selectable rows render no
 * checkbox, and select-all / indeterminate scope to selectable rows only. Here only even-`id`
 * rows are selectable.
 */
export const SelectableSubset: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${basicData}
      .columns=${plainColumns}
      .selection=${{ multiple: true, canSelect: (row: DemoRow) => row.id % 2 === 0 }}
    ></bit-table-v2>`,
};

/** `max` bounds the selection — capped to 3 of 5 rows here. */
export const SelectableCapped: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${basicData}
      .columns=${plainColumns}
      .selection=${{ multiple: true, max: 3 }}
    ></bit-table-v2>`,
};

/**
 * When no rows render — empty data, or a filter that excluded everything — the table shows a
 * default `bit-status-lockup`. Add a `slot="empty"` child to override it.
 */
export const Empty: Story = {
  render: () => html`<bit-table-v2 .data=${[]} .columns=${[idColumn, nameColumn]}></bit-table-v2>`,
};

/**
 * When `loading` is set, the table shows skeleton rows (count via `loading-rows`) in place of
 * data. Each column renders its `loading` content if it has one — here the Id column does —
 * otherwise a default skeleton.
 */
export const Loading: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${[]}
      loading
      loading-rows="4"
      .columns=${
        [
          {
            ...idColumn,
            width: "80px",
            loading: () => html`<bit-skeleton-text class="tw-w-8"></bit-skeleton-text>`,
          },
          nameColumn,
          otherColumn,
        ] satisfies TableV2Column<DemoRow>[]
      }
    ></bit-table-v2>`,
};

const paginatedData = rows(23);

/**
 * A `bit-table-paginator` inside the table slices its filtered (and sorted) rows to the page. The
 * paginator owns the page state (`page-index`, `page-size`) and reads the total row count back
 * from the table.
 */
export const Pagination: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${paginatedData}
      .columns=${
        [
          { ...idColumn, sortable: true, defaultSort: "asc", sortFn },
          { ...nameColumn, sortable: true },
          otherColumn,
        ] satisfies TableV2Column<DemoRow>[]
      }
    >
      <bit-table-paginator page-size="10" .pageSizeOptions=${[5, 10, 25]}></bit-table-paginator>
    </bit-table-v2>`,
};

/**
 * A toolbar `rangeLabel` shows which rows are on screen at the end of its filter row, in place of
 * the default "N items" count. The `start–end` run is emphasized.
 *
 * Page through to watch the range move; search `name-1` for a shorter list, `name-38` for a single
 * row, or anything unmatched for the empty case.
 */
export const RangeLabel: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${rows(39)}
      .filter=${(row: DemoRow, f: { search?: string }) =>
        row.name.toLowerCase().includes((f.search ?? "").trim().toLowerCase())}
      .columns=${
        [
          { ...idColumn, sortable: true, defaultSort: "asc", sortFn },
          { ...nameColumn, sortable: true },
          otherColumn,
        ] satisfies TableV2Column<DemoRow>[]
      }
    >
      <bit-table-toolbar .rangeLabel=${itemRangeLabel}>
        <bit-search placeholder="Search" aria-label="Search"></bit-search>
      </bit-table-toolbar>
      <bit-table-paginator page-size="10"></bit-table-paginator>
    </bit-table-v2>`,
};

@customElement("story-form-table")
class StoryFormTable extends LitElement {
  @state() private submitted?: string;
  @state() private locked = false;

  /** Values keyed by row id rather than position, so sorting can't repoint a cell at the wrong value. */
  private readonly emails = new Map(SEAT_ROWS.map((seat) => [seat.id, seat.email]));

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  private readonly submit = async () => {
    this.locked = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      this.submitted = JSON.stringify(Object.fromEntries(this.emails), null, 2);
    } finally {
      this.locked = false;
    }
  };

  protected render() {
    return html`<bit-table-v2
        .data=${SEAT_ROWS}
        .trackBy=${trackById}
        .columns=${
          [
            {
              name: "name",
              header: "Name",
              sortable: true,
              defaultSort: "asc",
              cell: (row) => row.name,
            },
            {
              name: "email",
              header: "Email",
              truncate: false,
              cell: (row) =>
                html`<bit-input
                  disable-margin
                  hide-label
                  label=${`Email for ${row.name}`}
                  ?disabled=${this.locked}
                  .value=${this.emails.get(row.id) ?? ""}
                  @input=${(e: Event) =>
                    this.emails.set(row.id, (e.target as HTMLInputElement).value)}
                ></bit-input>`,
            },
          ] satisfies TableV2Column<SeatRow>[]
        }
      ></bit-table-v2>
      <bit-button class="tw-mt-4" button-type="primary" .action=${this.submit}>Submit</bit-button>
      ${this.submitted ? html`<pre class="tw-mt-4 tw-text-xs">${this.submitted}</pre>` : nothing}`;
  }
}

/**
 * A table used as a form. Values are kept keyed by row id rather than by position, so sorting
 * can't repoint a cell at the wrong value.
 */
export const FormRecordRows: Story = {
  render: () => html`<story-form-table></story-form-table>`,
};

/**
 * For simple presentational tables: static rows and columns with no sort, selection, filter or
 * virtualization (Angular's manual mode).
 */
export const Manual: Story = {
  render: () =>
    html`<bit-table-v2
      .data=${[
        { product: "Password Manager", owner: "Everyone" },
        { product: "Secrets Manager", owner: "Developers" },
      ]}
      .columns=${[
        { name: "product", header: "Product", cell: (row: { product: string }) => row.product },
        { name: "owner", header: "Owner", cell: (row: { owner: string }) => row.owner },
      ]}
    ></bit-table-v2>`,
};

declare global {
  interface HTMLElementTagNameMap {
    "story-fill-resized-viewport": StoryFillResizedViewport;
    "story-filter-coachmark-table": StoryFilterCoachmarkTable;
    "story-url-sync-table": StoryUrlSyncTable;
    "story-form-table": StoryFormTable;
  }
}
