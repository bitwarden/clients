import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "../menu/menu";
import "../menu/menu-item";
import { showToast } from "../toast/toast-service";

import "./dialog";
import type { DialogRef, DrawerRef } from "./dialog-ref";
import { openDialog, openSimpleDialog } from "./dialog-service";
import { openDrawer } from "./drawer";

type Animal = { animal: string };

const content =
  (size: string, heading: string, closable = true) =>
  (ref: DialogRef<unknown, Animal>) =>
    html`<bit-dialog heading=${heading} dialog-size=${size}>
      Dialog body text goes here.
      <br />
      Animal: ${ref.data?.animal}
      <bit-button slot="footer" button-type="primary" @click=${() => ref.close()}>Save</bit-button>
      ${
        closable
          ? html`<bit-button slot="footer" button-type="secondary" data-bit-dialog-close
              >Cancel</bit-button
            >`
          : ""
      }
    </bit-dialog>`;

const discard = (level: number) => () =>
  openSimpleDialog({
    title: `Discard level ${level}?`,
    content: "You have unsaved changes. Close this drawer anyway?",
    type: "warning",
    acceptButtonText: "Discard",
    cancelButtonText: "Keep editing",
  });

const stacked = (ref: DialogRef<unknown, { level: number }>) => {
  const level = ref.data?.level ?? 1;
  return html`<bit-dialog heading="Level ${level} Drawer">
    <div class="tw-flex tw-flex-col tw-gap-4 tw-items-start">
      <span>This is level ${level} of the drawer stack.</span>
      ${
        level < 3
          ? html`<bit-button
              button-type="secondary"
              @click=${() =>
                (ref as DrawerRef<unknown, { level: number }>).stack(stacked, {
                  data: { level: level + 1 },
                  closePredicate: discard(level + 1),
                })}
              >Open Level ${level + 1}</bit-button
            >`
          : html`<span>You've reached the deepest level.</span>`
      }
    </div>
    <bit-button slot="footer" button-type="primary" data-bit-dialog-close>Done</bit-button>
  </bit-dialog>`;
};

const data = { animal: "panda" };

const buttons = html`<div class="tw-flex tw-flex-wrap tw-gap-2">
  <bit-button @click=${() => openDialog(content("default", "Dialog Title"), { data })}
    >Open Dialog</bit-button
  >
  <bit-button
    @click=${() =>
      openDialog(
        content(
          "default",
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore",
          false,
        ),
        { data, disableClose: true },
      )}
    >Open Non-Dismissable Dialog</bit-button
  >
  <bit-button @click=${() => openDrawer(content("default", "Dialog Title"), { data })}
    >Open Drawer</bit-button
  >
  <bit-button size="small" @click=${() => openDrawer(content("small", "Small Drawer"), { data })}
    >Open Small Drawer</bit-button
  >
  <bit-button @click=${() => openDrawer(content("large", "Large Drawer"), { data })}
    >Open Large Drawer</bit-button
  >
  <bit-button
    @click=${() => openDrawer(stacked, { data: { level: 1 }, closePredicate: discard(1) })}
    >Open Stacked Drawer</bit-button
  >
</div>`;

const clickButton =
  (index: number) =>
  async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    canvasElement.querySelectorAll<HTMLElement>("bit-button")[index]?.click();
  };

export default {
  title: "Component Library/Dialogs/Service",
  render: () => buttons,
} satisfies Meta;

type Story = StoryObj;

export const Default: Story = { play: clickButton(0) };

export const NonDismissable: Story = { play: clickButton(1) };

/** Without a `bit-drawer-outlet` in the page, drawers float at the inline end of the viewport. */
export const Drawer: Story = { play: clickButton(2) };

export const DrawerSmall: Story = { play: clickButton(3) };

export const DrawerLarge: Story = { play: clickButton(4) };

/** Two levels deep: the back button is visible on the level 2 drawer. */
export const DrawerStacked: Story = {
  play: async (context) => {
    await clickButton(5)(context);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const level1 = document.querySelector("bit-drawer-host bit-dialog");
    level1?.querySelector<HTMLElement>("bit-button")?.click();
  },
};

/** A layout places `bit-drawer-outlet` in its drawer column; drawers render there instead of floating. */
export const DrawerOutlet: Story = {
  render: () =>
    html`<div
      class="tw-grid tw-grid-cols-[1fr_auto] tw-h-[500px] tw-border tw-border-solid tw-border-secondary-300"
    >
      <main class="tw-p-4">${buttons}</main>
      <bit-drawer-outlet class="tw-w-[32rem] tw-max-w-[50vw]"></bit-drawer-outlet>
    </div>`,
  play: clickButton(2),
};

/** Menus and toasts opened from a modal dialog render above it and stay interactive. */
export const OverlaysInDialog: Story = {
  render: () =>
    html`<bit-button
      @click=${() =>
        openDialog(
          () =>
            html`<bit-dialog heading="Overlays">
              <bit-button id="dialog-menu-trigger">Actions</bit-button>
              <bit-menu trigger="dialog-menu-trigger">
                <bit-menu-item @click=${() => showToast({ variant: "success", message: "Copied" })}
                  >Copy</bit-menu-item
                >
                <bit-menu-item>Move</bit-menu-item>
              </bit-menu>
              <bit-button
                slot="footer"
                @click=${() => showToast({ variant: "info", message: "Toast from a dialog" })}
                >Show toast</bit-button
              >
            </bit-dialog>`,
        )}
      >Open Dialog</bit-button
    >`,
  play: clickButton(0),
};
