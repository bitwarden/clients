import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { TOOLTIP_DELAY_MS } from "../tooltip/attach-tooltip";
import "../button/button";

import { openFilterDialog } from "./filter-dialog";
import "./filter-divider";
import "./filter-menu";
import type { BitFilterMenu } from "./filter-menu";
import { FilterOptionIconTile, FilterOptionNode, isFilterPresenter } from "./filter-model";
import "./filter-option";
import "./filter-option-divider";
import "./filter-section";
import "./filter-toggle";

type Args = Record<string, never>;

const row = (content: unknown) =>
  html`<div class="tw-flex tw-flex-wrap tw-items-start tw-gap-2 tw-p-4">${content}</div>`;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** The chips in the story, in document order. */
const chips = (canvas: HTMLElement) =>
  Array.from(canvas.querySelectorAll<HTMLElement>("bit-filter-menu, bit-filter-toggle"));

/** Opens the `index`th chip's menu. */
const openChip = async (canvas: HTMLElement, index = 0) => {
  await customElements.whenDefined("bit-filter-menu");
  const chip = chips(canvas)[index] as BitFilterMenu;
  await chip.updateComplete;
  await nextFrame();
  chip.ariaTarget?.click();
  await chip.updateComplete;
  await nextFrame();
  return chip;
};

/** Opens the dialog over every chip in the story. */
const openDialogFrom = (event: Event) => {
  const scope = (event.currentTarget as HTMLElement).closest("[data-filter-scope]")!;
  openFilterDialog(Array.from(scope.querySelectorAll("*")).filter(isFilterPresenter));
};

export default {
  title: "Component Library/Filter Menu",
  component: "bit-filter-menu",
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

/**
 * A single-select chip, a multi-select chip, a multi-select chip with sections, and a toggle.
 * Each chip declares a `key` and owns its own selection; inside a filter host (e.g. a table) the
 * chips register themselves. The button opens the same chips in the responsive filter dialog.
 */
export const Default: Story = {
  render: () =>
    html`<div data-filter-scope>
      ${row(html`
        <bit-filter-menu key="type" placeholder-text="Type" unset-label="All">
          <bit-filter-option value="login" count="12">Login</bit-filter-option>
          <bit-filter-option value="card" count="3">Card</bit-filter-option>
          <bit-filter-option value="note" count="5">Secure note</bit-filter-option>
        </bit-filter-menu>

        <bit-filter-menu key="vault" placeholder-text="Vault" multiple>
          <bit-filter-option value="mine" count="20">My vault</bit-filter-option>
          <bit-filter-option value="acme" count="11">Acme corporation</bit-filter-option>
        </bit-filter-menu>

        <bit-filter-menu key="collection" placeholder-text="Collections" multiple>
          <bit-filter-section label="Engineering" collapsible>
            <bit-filter-option value="cicd" count="2">CI/CD</bit-filter-option>
            <bit-filter-option value="devtools" count="1">Dev tools</bit-filter-option>
          </bit-filter-section>
          <bit-filter-section label="Operations" collapsible>
            <bit-filter-option value="support" count="4">Support</bit-filter-option>
          </bit-filter-section>
        </bit-filter-menu>

        <bit-filter-divider></bit-filter-divider>

        <bit-filter-toggle
          key="favorites"
          label="Favorites"
          icon="bwi-star"
          icon-active="bwi-star-f"
        ></bit-filter-toggle>
      `)}
      <div class="tw-px-4">
        <bit-button button-type="secondary" size="small" @click=${openDialogFrom}
          >Open in filter dialog</bit-button
        >
      </div>
    </div>`,
};

/**
 * Options can render a leading icon tile. The chip forces `size="xs"`; a disabled option's tile
 * drops to `gray`.
 */
export const IconTiles: Story = {
  render: () =>
    row(html`
      <bit-filter-menu key="type" placeholder-text="Type" multiple>
        <bit-filter-option
          value="login"
          count="12"
          .iconTile=${{ icon: "bwi-globe", variant: "brand" }}
          >Login</bit-filter-option
        >
        <bit-filter-option
          value="card"
          count="3"
          .iconTile=${{ icon: "bwi-credit-card", variant: "teal" }}
          >Card</bit-filter-option
        >
        <bit-filter-option
          value="identity"
          .iconTile=${{ icon: "bwi-id-card", variant: "purple", emphasis: "bold" }}
          >Identity</bit-filter-option
        >
        <bit-filter-option value="note" .iconTile=${{ icon: "bwi-sticky-note", color: "#f8e71c" }}
          >Note with a custom color</bit-filter-option
        >
        <bit-filter-option
          value="sshKey"
          .iconTile=${{ icon: "bwi-key", variant: "green" }}
          disabled
          >SSH key</bit-filter-option
        >
      </bit-filter-menu>
    `),
  play: ({ canvasElement }) => openChip(canvasElement).then(() => undefined),
};

/**
 * Selecting a parent selects everything beneath it; a partly selected subtree draws
 * indeterminate up every level. Searching keeps a parent visible while a child matches.
 */
export const NestedOptions: Story = {
  render: () =>
    row(html`
      <bit-filter-menu key="collection" placeholder-text="Collections" multiple>
        <bit-filter-option value="eng" count="15" expanded>
          Engineering
          <bit-filter-option value="monitoring" count="20">Monitoring</bit-filter-option>
          <bit-filter-option value="infra" count="6">
            Infrastructure
            <bit-filter-option value="cicd" count="2">CI/CD</bit-filter-option>
          </bit-filter-option>
        </bit-filter-option>
        <bit-filter-option value="ops" count="3">Operations</bit-filter-option>
      </bit-filter-menu>

      <bit-filter-menu key="folder" placeholder-text="My folders" multiple>
        <bit-filter-option value="work" count="9">
          Work
          <bit-filter-option value="clients" count="4">Clients</bit-filter-option>
        </bit-filter-option>
        <bit-filter-option value="personal" count="5">Personal</bit-filter-option>
      </bit-filter-menu>
    `),
};

const nestedTree: FilterOptionNode<string>[] = [
  {
    value: "eng",
    label: "Engineering",
    count: 15,
    options: [
      { value: "monitoring", label: "Monitoring", count: 20 },
      {
        value: "infra",
        label: "Infrastructure",
        count: 6,
        options: [{ value: "cicd", label: "CI/CD", count: 2 }],
      },
    ],
  },
  { value: "ops", label: "Operations", count: 3 },
];

/**
 * The same tree as `NestedOptions`, built from data via `options` on the menu instead of child
 * elements — for a tree whose depth isn't known ahead of time, like a collection or folder list.
 */
export const DataDrivenNestedOptions: Story = {
  render: () =>
    row(html`
      <bit-filter-menu
        key="collection"
        placeholder-text="Collections"
        multiple
        .options=${nestedTree}
      ></bit-filter-menu>
    `),
};

/** A shared-folder path fifteen levels deep, with a sibling leaf at each level. */
const deepFolderPath = [
  "Clients and partner organizations",
  "Acme Corporation international holdings",
  "Finance and accounting department",
  "Payroll and compensation records",
  "Fiscal year 2026 reporting period",
  "Fourth quarter closing documents",
  "Independent contractors and consultants",
  "International operations and subsidiaries",
  "Europe, Middle East, and Africa region",
  "Germany country office and entities",
  "Berlin headquarters and satellite offices",
  "Monthly payroll runs and adjustments",
  "March payroll cycle and corrections",
  "Approved by finance leadership",
  "Signed copies with wet ink signatures",
];

const buildDeepFolderTree = (depth = 0): FilterOptionNode<string>[] => {
  if (depth === deepFolderPath.length) {
    return [];
  }
  const name = deepFolderPath[depth];
  return [
    { value: `folder-${depth}`, label: name, count: 12, options: buildDeepFolderTree(depth + 1) },
    { value: `leaf-${depth}`, label: `${name} archive`, count: 3 },
  ];
};

/**
 * A data-driven shared-folder tree fifteen levels deep. Deep rows scroll sideways instead of
 * truncating their labels to nothing. The button opens the same tree in the filter dialog.
 */
export const DeeplyNestedOptions: Story = {
  render: () =>
    html`<div data-filter-scope>
      ${row(html`
        <bit-filter-menu key="folder" placeholder-text="Shared folders" multiple>
          <bit-filter-section
            label="Acme Corporation shared folders"
            collapsible
            .options=${buildDeepFolderTree()}
          ></bit-filter-section>
        </bit-filter-menu>
        <bit-button button-type="secondary" size="small" @click=${openDialogFrom}
          >Open in filter dialog</bit-button
        >
      `)}
    </div>`,
  play: async ({ canvasElement }) => {
    const chip = await openChip(canvasElement);
    // Data-driven nodes start collapsed, so open each level in turn.
    const collapsed = () =>
      chip.shadowRoot!.querySelector<HTMLElement>(
        '[role="treeitem"][aria-expanded="false"]:not([data-filter-section-row]) [data-filter-expander]',
      );
    for (let next = collapsed(); next; next = collapsed()) {
      next.click();
      await chip.updateComplete;
    }
    (chip.shadowRoot!.activeElement as HTMLElement | null)?.blur();
  },
};

const tile: FilterOptionIconTile = { icon: "bwi-clock", variant: "brand" };

/**
 * Nested options with a leading icon tile on every row: nine rows alternating individual and
 * group, each group opening the next level down. Leaves reserve the chevron's column, so the
 * tiles line up at each level.
 */
export const NestedIconTiles: Story = {
  render: () =>
    row(html`
      <bit-filter-menu key="collection" placeholder-text="Collections" multiple>
        <bit-filter-option value="individual-1" count="456" .iconTile=${tile}
          >Item label</bit-filter-option
        >
        <bit-filter-option value="group-1" count="456" .iconTile=${tile} expanded>
          Item label
          <bit-filter-option value="individual-2" count="456" .iconTile=${tile}
            >Item label</bit-filter-option
          >
          <bit-filter-option value="group-2" count="456" .iconTile=${tile} expanded>
            Item label
            <bit-filter-option value="individual-3" count="456" .iconTile=${tile}
              >Item label</bit-filter-option
            >
            <bit-filter-option value="group-3" count="456" .iconTile=${tile} expanded>
              Item label
              <bit-filter-option value="individual-4" count="456" .iconTile=${tile}
                >Item label</bit-filter-option
              >
              <bit-filter-option value="group-4" count="456" .iconTile=${tile} expanded>
                Item label
                <bit-filter-option value="individual-5" count="456" .iconTile=${tile}
                  >Item label</bit-filter-option
                >
              </bit-filter-option>
            </bit-filter-option>
          </bit-filter-option>
        </bit-filter-option>
      </bit-filter-menu>
    `),
  play: ({ canvasElement }) => openChip(canvasElement).then(() => undefined),
};

/** Opens the menu and types `term` into its search. */
const searchForPlay =
  (term: string): Story["play"] =>
  async ({ canvasElement }) => {
    const chip = await openChip(canvasElement);
    const search = chip.shadowRoot!.querySelector<HTMLElement & { value: string }>(
      "[data-filter-search]",
    )!;
    search.value = term;
    search.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  };

/** `searchable` shows the in-menu search on a chip with ten or fewer options. */
export const Searchable: Story = {
  render: () =>
    row(html`
      <bit-filter-menu key="status" placeholder-text="Status" multiple searchable>
        <bit-filter-option value="invited" count="4">Invited</bit-filter-option>
        <bit-filter-option value="accepted" count="4">Needs confirmation</bit-filter-option>
        <bit-filter-option value="confirmed" count="60">Active</bit-filter-option>
      </bit-filter-menu>
    `),
  play: ({ canvasElement }) => openChip(canvasElement).then(() => undefined),
};

const names = [
  "Engineering",
  "Operations",
  "Project management",
  "Security",
  "Design",
  "Marketing",
  "Sales",
  "Finance",
  "Legal",
  "Support",
  "Research",
  "Facilities",
];

/**
 * No option matches the search term. Without `searchable`, the in-menu search needs more than ten
 * options.
 */
export const NoMatchingItems: Story = {
  render: () =>
    row(html`
      <bit-filter-menu key="collection" placeholder-text="Collections" multiple>
        ${names.map(
          (name) => html`<bit-filter-option .value=${name} count="3">${name}</bit-filter-option>`,
        )}
      </bit-filter-menu>
    `),
  play: searchForPlay("zzz"),
};

/** A long search term with no spaces, clamped to two lines in the no-results message. */
export const NoMatchingItemsLongSearchTerm: Story = {
  ...NoMatchingItems,
  play: searchForPlay("Quarterlyinfrastructurereviewfortheplatformengineeringteam"),
};

/**
 * `bit-filter-option-divider` separates runs of options. The popover draws a rule; the responsive
 * dialog starts a new card instead, so the groups read as separate cards.
 */
export const OptionDividers: Story = {
  render: () =>
    html`<div data-filter-scope>
      ${row(html`
        <bit-filter-menu key="folder" placeholder-text="My folders" multiple>
          <bit-filter-option .value=${null} count="5">No folders</bit-filter-option>
          <bit-filter-option-divider></bit-filter-option-divider>
          <bit-filter-option value="entertainment" count="5">Entertainment</bit-filter-option>
          <bit-filter-option value="healthcare" count="5">Healthcare</bit-filter-option>
          <bit-filter-option value="social" count="5">Social media</bit-filter-option>
          <bit-filter-option value="work" count="5">Work</bit-filter-option>
        </bit-filter-menu>
        <bit-button button-type="secondary" size="small" @click=${openDialogFrom}
          >Open in filter dialog</bit-button
        >
      `)}
    </div>`,
  play: ({ canvasElement }) => openChip(canvasElement).then(() => undefined),
};

const longLabels = row(html`
  <bit-filter-menu key="collection" placeholder-text="Shared folders" multiple>
    <bit-filter-section label="Bitwarden Design System and Component Library" collapsible>
      <bit-filter-option value="onboarding" expanded>
        Onboarding materials for new design system contributors
        <bit-filter-option value="tokens">
          Design tokens, themes, and every palette we publish
        </bit-filter-option>
      </bit-filter-option>
    </bit-filter-section>
  </bit-filter-menu>

  <bit-filter-menu key="folder" placeholder-text="My folders" unset-label="All">
    ${[
      "Household paperwork, warranties, and appliance manuals",
      "Streaming subscriptions I keep meaning to cancel",
    ].map((folder) => html`<bit-filter-option .value=${folder}>${folder}</bit-filter-option>`)}
  </bit-filter-menu>
`);

/**
 * A label longer than its row truncates rather than wraps, so every row carries a tooltip with the
 * full text: the section header, the parent option, and the nested child. The story hovers the
 * first row and waits out the delay. The chip trigger truncates too, but carries no tooltip.
 */
export const LongLabels: Story = {
  render: () => longLabels,
  play: async ({ canvasElement }) => {
    const chip = await openChip(canvasElement);
    chip
      .shadowRoot!.querySelector("[role=treeitem] [data-filter-row-label]")
      ?.dispatchEvent(new MouseEvent("mouseenter"));
    await new Promise((resolve) => setTimeout(resolve, TOOLTIP_DELAY_MS + 100));
  },
};

/**
 * The same long names on a single-select chip: flat option rows, plus the auto-injected "All"
 * row, which is tooltipped from `unset-label` for the consumer who passes a long one.
 */
export const LongLabelsSingleSelect: Story = {
  render: () => longLabels,
  play: ({ canvasElement }) => openChip(canvasElement, 1).then(() => undefined),
};

/** Long labels beside counts: the label should truncate while the count stays whole. */
export const LongLabelsWithCounts: Story = {
  render: () =>
    row(html`
      <bit-filter-menu key="collection" placeholder-text="Shared folders" multiple>
        <bit-filter-section label="Bitwarden Design System and Component Library" collapsible>
          <bit-filter-option value="onboarding" count="128" expanded>
            Onboarding materials for new design system contributors
            <bit-filter-option value="tokens" count="1024">
              Design tokens, themes, and every palette we publish
            </bit-filter-option>
          </bit-filter-option>
        </bit-filter-section>
      </bit-filter-menu>

      <bit-filter-menu key="folder" placeholder-text="My folders" unset-label="All">
        ${[
          { name: "Household paperwork, warranties, and appliance manuals", count: 42 },
          { name: "Streaming subscriptions I keep meaning to cancel", count: 7 },
        ].map(
          (folder) =>
            html`<bit-filter-option .value=${folder.name} .count=${folder.count}
              >${folder.name}</bit-filter-option
            >`,
        )}
      </bit-filter-menu>
    `),
  play: ({ canvasElement }) => openChip(canvasElement).then(() => undefined),
};

/**
 * A disabled chip explains why through `disabled-tooltip`: its only tooltip, which also becomes
 * the trigger's accessible description. The story hovers the toggle to show it.
 */
export const DisabledReason: Story = {
  render: () =>
    row(html`
      <bit-filter-toggle
        key="favorites"
        label="Favorites"
        icon="bwi-star"
        icon-active="bwi-star-f"
        disabled
        disabled-tooltip="No favorites to show"
      ></bit-filter-toggle>

      <bit-filter-menu
        key="sharedFolder"
        placeholder-text="Shared folders"
        multiple
        disabled
        disabled-tooltip="No shared folders to show"
      ></bit-filter-menu>
    `),
  play: async ({ canvasElement }) => {
    await customElements.whenDefined("bit-filter-toggle");
    const [toggle] = chips(canvasElement) as (HTMLElement & {
      updateComplete: Promise<unknown>;
      ariaTarget: HTMLElement;
    })[];
    await toggle.updateComplete;
    toggle.ariaTarget.dispatchEvent(new MouseEvent("mouseenter"));
    await new Promise((resolve) => setTimeout(resolve, TOOLTIP_DELAY_MS + 100));
  },
};

/** Sizes and full width, shared with the other chips. */
export const Sizes: Story = {
  render: () =>
    html`${row(html`
        <bit-filter-menu key="type" placeholder-text="Type" size="small" icon="bwi-filter">
          <bit-filter-option value="login">Login</bit-filter-option>
        </bit-filter-menu>
        <bit-filter-toggle key="favorites" label="Favorites" size="small" icon="bwi-star">
        </bit-filter-toggle>
      `)}
      <div class="tw-w-80 tw-p-4">
        <bit-filter-menu key="vault" placeholder-text="Vault" multiple full-width>
          <bit-filter-option value="mine">My vault</bit-filter-option>
        </bit-filter-menu>
      </div>`,
};
