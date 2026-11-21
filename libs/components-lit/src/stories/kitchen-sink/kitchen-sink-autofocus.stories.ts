import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import { expect, waitFor } from "storybook/test";

import { getDeepActiveElement } from "../../core/focus";
import { positionFixedWrapperDecorator } from "../storybook-decorators";

import "./kitchen-sink-app";
import { clickDeep, nameOf, navigateTo } from "./story-queries";

type Args = { legacy: boolean };

export default {
  title: "Documentation/Kitchen Sink/Tests/Autofocus",
  component: "bit-kitchen-sink-app",
  decorators: [positionFixedWrapperDecorator()],
  args: { legacy: true },
  render: (args) => html`<bit-kitchen-sink-app ?legacy=${args.legacy}></bit-kitchen-sink-app>`,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

/** The focused element, and the custom element whose shadow root it's in (if any). */
function focused() {
  const element = getDeepActiveElement();
  const root = element?.getRootNode();
  const host = root instanceof ShadowRoot ? (root.host as HTMLElement) : undefined;
  return { element, host };
}

async function openFromMenu(canvas: HTMLElement, item: string) {
  await navigateTo("/bitwarden");
  await clickDeep(canvas, "bit-button", "Open Dialog from Menu");
  await clickDeep(canvas.ownerDocument.body, "bit-menu-item", item);
}

/**
 * Dialog opened from a menu item — focus should land on the dialog header since no
 * child element has `autofocus`.
 */
export const DialogHeaderFocus: Story = {
  play: async ({ canvasElement }) => {
    await openFromMenu(canvasElement, "Open Dialog");
    await waitFor(async () => {
      const { element, host } = focused();
      await expect(host?.localName).toBe("bit-dialog");
      await expect(element?.textContent?.trim()).toBe("Dialog Title");
    });
  },
};

/**
 * Dialog with an `autofocus` field opened from a menu item — focus should land on the
 * input, not the dialog header.
 */
export const DialogAutofocusFieldFocus: Story = {
  play: async ({ canvasElement }) => {
    await openFromMenu(canvasElement, "Open Dialog with Autofocus");
    await waitFor(async () => {
      const { element, host } = focused();
      await expect(element?.localName).toBe("input");
      await expect(host && nameOf(host)).toBe("Username");
    });
  },
};

/**
 * Simple dialog opened from a menu item — focus should land on the first footer button.
 */
export const SimpleDialogButtonFocus: Story = {
  play: async ({ canvasElement }) => {
    await openFromMenu(canvasElement, "Open Simple Dialog");
    await waitFor(async () => {
      const { host } = focused();
      await expect(host?.localName).toBe("bit-button");
      await expect(host && nameOf(host)).toBe("Yes");
    });
  },
};
