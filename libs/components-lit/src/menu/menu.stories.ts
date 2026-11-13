import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "../icon/icon";
import "../icon-button/icon-button";
import "../icon-tile/icon-tile";

import "./menu";
import type { BitMenu } from "./menu";
import { menuTrigger } from "./menu-directive";
import "./menu-divider";
import "./menu-item";

type Args = Record<string, never>;

const defaultItems = html`
  <bit-menu-item href="#">Anchor link</bit-menu-item>
  <bit-menu-item href="#">Another link</bit-menu-item>
  <bit-menu-item>Button</bit-menu-item>
  <bit-menu-item variant="danger">Danger button</bit-menu-item>
  <bit-menu-divider></bit-menu-divider>
  <bit-menu-item>
    <bit-icon name="bwi-key" slot="start"></bit-icon>
    Button with icons
    <bit-icon name="bwi-angle-right" slot="end"></bit-icon>
  </bit-menu-item>
  <bit-menu-item variant="danger">
    <bit-icon name="bwi-trash" slot="start"></bit-icon>
    Danger button with icon
  </bit-menu-item>
  <bit-menu-item disabled>
    <bit-icon name="bwi-clone" slot="start"></bit-icon>
    Disabled button
  </bit-menu-item>
`;

const openFirstTrigger = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  canvasElement.querySelector<HTMLElement>("[data-trigger]")?.click();
};

export default {
  title: "Component Library/Menu",
  component: "bit-menu",
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const OpenMenu: Story = {
  render: () =>
    html`<div class="tw-h-72 tw-w-fit"><bit-menu inline>${defaultItems}</bit-menu></div>`,
};

export const ClosedMenu: Story = {
  render: () =>
    html`<div class="tw-h-80">
      <bit-button id="menu-trigger" button-type="secondary">Open menu</bit-button>
      <bit-menu trigger="menu-trigger">${defaultItems}</bit-menu>
    </div>`,
};

export const IconTileMenu: Story = {
  render: () =>
    html`<div class="tw-w-[200px]">
      <bit-menu inline>
        ${(
          [
            ["bwi-globe", "brand", "Login"],
            ["bwi-credit-card", "teal", "Card"],
            ["bwi-id-card", "purple", "Identity"],
            ["bwi-sticky-note", "orange", "Note"],
            ["bwi-key", "green", "SSH Key"],
          ] as const
        ).map(
          ([icon, variant, label]) =>
            html`<bit-menu-item>
              <bit-icon-tile icon=${icon} variant=${variant} size="xs" slot="start"></bit-icon-tile>
              ${label}
            </bit-menu-item>`,
        )}
        <bit-menu-divider></bit-menu-divider>
        <bit-menu-item disabled>
          <bit-icon-tile icon="bwi-folder" variant="gray" size="xs" slot="start"></bit-icon-tile>
          Disabled item
        </bit-menu-item>
      </bit-menu>
    </div>`,
};

export const ActionMenu: Story = {
  render: () =>
    html`<div class="tw-flex tw-gap-4">
      <div class="tw-w-[200px]">
        <bit-menu inline>
          ${(
            [
              ["bwi-globe", "Login"],
              ["bwi-credit-card", "Card"],
              ["bwi-id-card", "Identity"],
              ["bwi-sticky-note", "Note"],
              ["bwi-key", "SSH Key"],
            ] as const
          ).map(
            ([icon, label]) =>
              html`<bit-menu-item>
                <bit-icon name=${icon} slot="start"></bit-icon>${label}
              </bit-menu-item>`,
          )}
          <bit-menu-divider></bit-menu-divider>
          <bit-menu-item><bit-icon name="bwi-folder" slot="start"></bit-icon>Folder</bit-menu-item>
          <bit-menu-item
            ><bit-icon name="bwi-shared-folder" slot="start"></bit-icon>Shared folder</bit-menu-item
          >
        </bit-menu>
      </div>
      <div class="tw-w-[200px]">
        <bit-menu inline>
          <bit-menu-item>Autofill</bit-menu-item>
          <bit-menu-item>Favorite</bit-menu-item>
          <bit-menu-item>Edit</bit-menu-item>
          <bit-menu-item>Clone</bit-menu-item>
          <bit-menu-item>Add to shared folder</bit-menu-item>
          <bit-menu-divider></bit-menu-divider>
          <bit-menu-item variant="danger">Delete</bit-menu-item>
        </bit-menu>
      </div>
    </div>`,
};

/** Open state from a trigger. Arrow keys, Home/End and typing move between items; Escape and Tab close. */
export const KeyboardNavigation: Story = {
  render: () =>
    html`<div class="tw-h-80">
      <bit-button id="kbd-trigger" data-trigger button-type="secondary">Open menu</bit-button>
      <bit-menu trigger="kbd-trigger">${defaultItems}</bit-menu>
    </div>`,
  play: openFirstTrigger,
};

/** An icon-button trigger: its tooltip is suppressed while the menu is open. */
export const IconButtonTrigger: Story = {
  render: () =>
    html`<div class="tw-h-80 tw-flex tw-justify-end">
      <bit-icon-button
        id="icon-trigger"
        data-trigger
        icon="bwi-ellipsis-v"
        label="Options"
      ></bit-icon-button>
      <bit-menu trigger="icon-trigger" position="below-end">
        <bit-menu-item>Edit</bit-menu-item>
        <bit-menu-item>Clone</bit-menu-item>
        <bit-menu-divider></bit-menu-divider>
        <bit-menu-item variant="danger">Delete</bit-menu-item>
      </bit-menu>
    </div>`,
  play: openFirstTrigger,
};

/** `menuTrigger(menu)` for Lit templates. Items can be nested in other markup. */
export const LitDirective: Story = {
  render: () => {
    const menu = document.createElement("bit-menu") as BitMenu;
    menu.label = "Nested items";
    return html`<div class="tw-h-80">
      <bit-button data-trigger ${menuTrigger(menu, { position: "below-start" })}
        >Open menu</bit-button
      >
      ${menu}
    </div>`;
  },
  play: async (context) => {
    const menu = context.canvasElement.querySelector("bit-menu")!;
    menu.innerHTML = `
      <section><bit-menu-item>Wrapped item one</bit-menu-item></section>
      <div><div><bit-menu-item>Deeply wrapped item two</bit-menu-item></div></div>
      <bit-menu-item>Item three</bit-menu-item>`;
    await openFirstTrigger(context);
  },
};

/** `menu-role="dialog"` keeps focus in the menu for interactive content; `data-bit-menu-close` marks content that closes it. */
export const DialogRole: Story = {
  render: () =>
    html`<div class="tw-h-96">
      <bit-button id="dialog-trigger" data-trigger button-type="secondary">Filters</bit-button>
      <bit-menu trigger="dialog-trigger" menu-role="dialog" label="Filters">
        <label class="tw-flex tw-gap-2 tw-p-2"><input type="checkbox" /> Favorites</label>
        <label class="tw-flex tw-gap-2 tw-p-2"><input type="checkbox" /> Shared</label>
        <bit-menu-item>Closes the menu</bit-menu-item>
        <div slot="footer" class="tw-flex tw-justify-end">
          <bit-button size="small" data-bit-menu-close>Done</bit-button>
        </div>
      </bit-menu>
    </div>`,
  play: openFirstTrigger,
};

/** `context-menu` opens the menu at the pointer on right-click. */
export const ContextMenu: Story = {
  render: () =>
    html`<div
        id="context-area"
        class="tw-h-60 tw-flex tw-items-center tw-justify-center tw-border tw-border-dashed tw-border-secondary-300 tw-rounded-lg"
      >
        Right-click anywhere in this area
      </div>
      <bit-menu trigger="context-area" context-menu>
        <bit-menu-item>Copy</bit-menu-item>
        <bit-menu-item>Paste</bit-menu-item>
      </bit-menu>`,
};
