import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, LitElement } from "lit";

import "./bulk-action";
import "./bulk-actions-bar";
import "../checkbox/checkbox";
import "../table/table";
import type { TableColumn } from "../table/table";

type Args = { selectedCount: number };

const noop = () => {
  /* story callback */
};

type Row = { id: number; name: string; type: string };

/** Story-only selectable table. Wires `selected-count` and `clear` the way a consumer would. */
class StoryBulkActionsTable extends LitElement {
  static properties = { selected: { state: true } };
  selected = new Set<number>();

  private readonly rows: Row[] = [
    { id: 1, name: "GitHub", type: "Login" },
    { id: 2, name: "AWS root", type: "Login" },
    { id: 3, name: "Passport", type: "Identity" },
    { id: 4, name: "Visa **** 4242", type: "Card" },
    { id: 5, name: "Wi-Fi password", type: "Secure note" },
    { id: 6, name: "1Password import", type: "Login" },
  ];

  protected createRenderRoot() {
    return this;
  }

  private toggle(id: number) {
    const next = new Set(this.selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected = next;
  }

  private toggleAll() {
    this.selected =
      this.selected.size === this.rows.length ? new Set() : new Set(this.rows.map((r) => r.id));
  }

  private clearAll = () => (this.selected = new Set());

  render() {
    const count = this.selected.size;
    const all = count > 0 && count === this.rows.length;
    const columns: TableColumn<Row>[] = [
      {
        id: "select",
        width: "2rem",
        header: html`<bit-checkbox
          label="Select all"
          hide-label
          disable-margin
          .checked=${all}
          .indeterminate=${count > 0 && !all}
          @change=${() => this.toggleAll()}
        ></bit-checkbox>`,
        cell: (r) =>
          html`<bit-checkbox
            label="Select ${r.name}"
            hide-label
            disable-margin
            .checked=${this.selected.has(r.id)}
            @change=${() => this.toggle(r.id)}
          ></bit-checkbox>`,
      },
      { id: "name", header: "Name", cell: (r) => r.name },
      { id: "type", header: "Type", cell: (r) => r.type },
    ];
    return html`<bit-table .columns=${columns} .rows=${this.rows}></bit-table>

      <bit-bulk-actions-bar selected-count=${count} @clear=${this.clearAll}>
        <bit-bulk-action .action=${noop} icon="bwi-folder" label="Move"></bit-bulk-action>
        <bit-bulk-action .action=${noop} icon="bwi-archive" label="Archive"></bit-bulk-action>
        <bit-bulk-action .action=${this.clearAll} icon="bwi-trash" label="Delete"></bit-bulk-action>
        <bit-bulk-additional-action
          .action=${noop}
          icon="bwi-upload"
          label="Export"
        ></bit-bulk-additional-action>
        <bit-bulk-additional-action .action=${noop} label="Share"></bit-bulk-additional-action>
      </bit-bulk-actions-bar>`;
  }
}
if (!customElements.get("story-bulk-actions-table")) {
  customElements.define("story-bulk-actions-table", StoryBulkActionsTable);
}

const primaries = html`<bit-bulk-action
    .action=${noop}
    icon="bwi-folder"
    label="Move"
  ></bit-bulk-action>
  <bit-bulk-action .action=${noop} icon="bwi-archive" label="Archive"></bit-bulk-action>
  <bit-bulk-action .action=${noop} icon="bwi-trash" label="Delete"></bit-bulk-action>`;

// eslint-disable-next-line no-console
const logClear = () => console.log("clear");

export default {
  title: "Component Library/Bulk Actions Bar",
  component: "bit-bulk-actions-bar",
  args: {
    selectedCount: 3,
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {
  render: (args) =>
    html`<bit-bulk-actions-bar selected-count=${args.selectedCount} @clear=${logClear}>
      ${primaries}
    </bit-bulk-actions-bar>`,
};

export const WithAdditionalActions: Story = {
  render: (args) =>
    html`<bit-bulk-actions-bar selected-count=${args.selectedCount} @clear=${logClear}>
      ${primaries}
      <bit-bulk-additional-action
        .action=${noop}
        icon="bwi-upload"
        label="Export"
      ></bit-bulk-additional-action>
      <bit-bulk-additional-action
        .action=${noop}
        icon="bwi-share"
        label="Share"
      ></bit-bulk-additional-action>
      <bit-bulk-additional-action
        .action=${noop}
        label="Move to organization"
      ></bit-bulk-additional-action>
    </bit-bulk-actions-bar>`,
};

export const WithTableSelection: Story = {
  render: () => html`<story-bulk-actions-table></story-bulk-actions-table>`,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const Compact: Story = {
  render: (args) =>
    html`<div class="tw-relative tw-w-[325px] tw-h-32" style="transform: translateX(0)">
      <bit-bulk-actions-bar selected-count=${args.selectedCount} @clear=${logClear}>
        ${primaries}
      </bit-bulk-actions-bar>
    </div>`,
};

export const WithOverflow: Story = {
  render: (args) =>
    html`<div
      class="tw-relative tw-h-20 tw-border tw-border-solid tw-border-border-base"
      style="transform: translateX(0); width: 260px; resize: horizontal; overflow: hidden"
    >
      <bit-bulk-actions-bar selected-count=${args.selectedCount} @clear=${logClear}>
        ${primaries}
        <bit-bulk-action .action=${noop} icon="bwi-star" label="Favorite"></bit-bulk-action>
        <bit-bulk-action .action=${noop} icon="bwi-lock" label="Lock"></bit-bulk-action>

        <bit-bulk-additional-action
          .action=${noop}
          icon="bwi-upload"
          label="Export"
        ></bit-bulk-additional-action>
        <bit-bulk-additional-action
          .action=${noop}
          label="Move to organization"
        ></bit-bulk-additional-action>
      </bit-bulk-actions-bar>
    </div>`,
};

/** Interaction: the overflow story with the "Additional actions" menu open. */
export const WithOverflowMenuOpen: Story = {
  render: (args) => html`<div class="tw-h-72">${WithOverflow.render!(args, {} as never)}</div>`,
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const bar = canvasElement.querySelector("bit-bulk-actions-bar");
    bar?.shadowRoot?.querySelector<HTMLElement>(".more")?.click();
  },
};

/** Interaction: Cmd/Ctrl+B moves focus into the toolbar; arrow keys move between its items. */
export const KeyboardFocus: Story = {
  render: (args) =>
    html`<button type="button" id="before">Focus starts here</button>
      ${WithAdditionalActions.render!(args, {} as never)}`,
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    canvasElement.querySelector<HTMLElement>("#before")?.focus();
    const isMac = /Mac/.test(navigator.platform);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "b", metaKey: isMac, ctrlKey: !isMac, bubbles: true }),
    );
  },
};

export const Hidden: Story = {
  ...Default,
  args: {
    selectedCount: 0,
  },
};
