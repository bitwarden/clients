import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import { action } from "storybook/actions";

import "../button/button";
import "../dialog/dialog";
import { openDialog } from "../dialog/dialog-service";

import "./multi-select";
import type { SelectItemView } from "./select-item-view";

type Args = {
  name: string;
  hint: string;
  baseItems: SelectItemView[];
  loading?: boolean;
  disabled?: boolean;
  removeSelectedItems?: boolean;
};

const showFormData = (event: SubmitEvent) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  form.querySelector("output")!.textContent = new FormData(form).getAll("select").join(", ");
};

export default {
  title: "Component Library/Form/Multi Select",
  component: "bit-multi-select",
  render: (args) =>
    html`<form class="tw-h-96" @submit=${showFormData}>
      <bit-multi-select
        name="select"
        required
        label=${args.name}
        hint=${args.hint}
        .baseItems=${args.baseItems}
        ?remove-selected-items=${args.removeSelectedItems}
        ?loading=${args.loading}
        ?disabled=${args.disabled}
        @itemsConfirmed=${(e: CustomEvent<SelectItemView[]>) => action("itemsConfirmed")(e.detail)}
      ></bit-multi-select>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
      <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
    </form>`,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

const groups: SelectItemView[] = Array.from({ length: 7 }, (_, i) => ({
  id: String(i + 1),
  listName: `Group ${i + 1}`,
  labelName: `Group ${i + 1}`,
  icon: "bwi-family",
}));

export const Loading: Story = {
  args: {
    baseItems: [],
    name: "Loading",
    hint: "This is what a loading multi-select looks like",
    loading: true,
  },
};

export const Disabled: Story = {
  args: {
    baseItems: [],
    name: "Disabled",
    disabled: true,
    hint: "This is what a disabled multi-select looks like",
  },
};

export const Groups: Story = {
  args: {
    name: "Select groups",
    hint: "Groups will be assigned to the associated member",
    baseItems: groups,
  },
};

/**
 * `iconTile` renders a `bit-icon-tile` in place of `icon` in the list. Selected items are rendered as
 * chips, which have no slot for a tile, so they continue to use `icon`.
 */
export const IconTiles: Story = {
  args: {
    name: "Select item types",
    hint: "Item types will be included in the export",
    baseItems: [
      {
        id: "1",
        listName: "Login",
        labelName: "Login",
        icon: "bwi-globe",
        iconTile: { icon: "bwi-globe", variant: "brand" },
      },
      {
        id: "2",
        listName: "Card",
        labelName: "Card",
        icon: "bwi-credit-card",
        iconTile: { icon: "bwi-credit-card", variant: "teal" },
      },
      {
        id: "3",
        listName: "Identity",
        labelName: "Identity",
        icon: "bwi-id-card",
        iconTile: { icon: "bwi-id-card", variant: "purple", emphasis: "bold" },
      },
      {
        id: "4",
        listName: "Note with a custom color",
        labelName: "Note",
        icon: "bwi-sticky-note",
        iconTile: { icon: "bwi-sticky-note", color: "#f8e71c" },
      },
      {
        id: "5",
        listName: "SSH key",
        labelName: "SSH key",
        icon: "bwi-key",
        iconTile: { icon: "bwi-key", variant: "green" },
      },
    ],
  },
};

const members: SelectItemView[] = [
  ["Joe Smith", "jsmith"],
  ["Tania Stone", "tstone"],
  ["Matt Matters", "mmatters"],
  ["Bob Robertson", "brobertson"],
  ["Ashley Fletcher", "aflectcher"],
  ["Rita Olson", "rolson"],
].map(([name, user], i) => ({
  id: String(i + 1),
  listName: `${name} (${user}@mail.me)`,
  labelName: name,
  icon: "bwi-user",
}));

export const Members: Story = {
  args: {
    name: "Select members",
    hint: "Members will be assigned to the associated group/shared folder",
    baseItems: [
      ...members,
      {
        id: "7",
        listName: "Final listName (fname@mail.me)",
        labelName: "Final listName (fname@mail.me)",
        icon: "bwi-user",
      },
    ],
  },
};

const folder = (id: string, listName: string, parentGrouping?: string): SelectItemView => ({
  id,
  listName,
  labelName: listName,
  icon: "bwi-shared-folder",
  parentGrouping,
});

export const SharedFolders: Story = {
  args: {
    name: "Select shared folders",
    hint: "Shared folders will be assigned to the associated member",
    baseItems: [
      folder("1", "Shared Folder 1"),
      folder("2", "Shared Folder 2"),
      folder("3", "Shared Folder 3"),
      folder("3.5", "Child Shared Folder 1 for Parent 1", "Parent 1"),
      folder("3.55", "Child Shared Folder 2 for Parent 1", "Parent 1"),
      folder("3.59", "Child Shared Folder 3 for Parent 1", "Parent 1"),
      folder("3.75", "Child Shared Folder 1 for Parent 2", "Parent 2"),
      folder("4", "Shared Folder 4"),
      folder("5", "Shared Folder 5"),
      folder("6", "Shared Folder 6"),
      folder("7", "Shared Folder 7"),
    ],
  },
};

export const MembersAndGroups: Story = {
  args: {
    name: "Select groups and members",
    hint: "Members/Groups will be assigned to the associated shared folder",
    baseItems: [
      ...groups.slice(0, 5),
      { id: "6", listName: "Joe Smith (jsmith@mail.me)", labelName: "Joe Smith", icon: "bwi-user" },
      {
        id: "7",
        listName: "Tania Stone (tstone@mail.me)",
        labelName: "(tstone@mail.me)",
        icon: "bwi-user",
      },
    ],
  },
};

export const RemoveSelected: Story = {
  args: {
    name: "Select groups",
    hint: "Groups will be removed from the list once the dropdown is closed",
    baseItems: groups,
    removeSelectedItems: true,
  },
};

/** The listbox open with two items selected. */
export const Open: Story = {
  args: { ...SharedFolders.args },
  render: (args) =>
    html`<div class="tw-h-96">
      <bit-multi-select
        label=${args.name}
        .baseItems=${args.baseItems}
        .value=${args.baseItems.slice(0, 2)}
      ></bit-multi-select>
    </div>`,
  play: async ({ canvasElement }) => {
    const select = canvasElement.querySelector("bit-multi-select")!;
    await select.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    select.shadowRoot?.querySelector("input")?.click();
  },
};

/** Escape closes the listbox (discarding the selection) without closing the dialog. */
export const InDialog: Story = {
  args: { ...Groups.args },
  render: (args) =>
    html`<bit-button
      @click=${() =>
        openDialog(
          () =>
            html`<bit-dialog heading="Multi-select in a dialog">
              <bit-multi-select label=${args.name} .baseItems=${args.baseItems}></bit-multi-select>
              <bit-button slot="footer" button-type="primary" data-bit-dialog-close
                >Done</bit-button
              >
            </bit-dialog>`,
        )}
      >Open dialog</bit-button
    >`,
};
