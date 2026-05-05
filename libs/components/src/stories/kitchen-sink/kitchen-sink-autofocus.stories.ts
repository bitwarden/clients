import { Meta, StoryObj } from "@storybook/angular";
import { expect, fireEvent, getByRole, waitFor } from "storybook/test";

import { KitchenSinkAppComponent } from "./components/kitchen-sink-app.component";
import kitchenSinkMeta from "./kitchen-sink.stories";

export default {
  ...kitchenSinkMeta,
  title: "Documentation / Kitchen Sink / Tests / Autofocus",
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} as Meta;

type Story = StoryObj<KitchenSinkAppComponent>;

async function navigateTo(path: string) {
  window.location.hash = path;
  await new Promise((resolve) => setTimeout(resolve, 50));
}

/**
 * Dialog opened from a menu item — focus should land on the dialog header since no
 * child element has appAutofocus.
 */
export const DialogHeaderFocus: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/bitwarden");
    await fireEvent.click(getByRole(canvas, "button", { name: "Open Dialog from Menu" }));
    await fireEvent.click(
      getByRole(canvas.ownerDocument.body, "menuitem", { name: "Open Dialog" }),
    );
    await waitFor(() =>
      expect(
        getByRole(canvas.ownerDocument.body, "heading", { name: "Dialog Title" }),
      ).toHaveFocus(),
    );
  },
};

/**
 * Dialog with an appAutofocus field opened from a menu item — focus should land on
 * the input, not the dialog header.
 */
export const DialogAutofocusFieldFocus: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/bitwarden");
    await fireEvent.click(getByRole(canvas, "button", { name: "Open Dialog from Menu" }));
    await fireEvent.click(
      getByRole(canvas.ownerDocument.body, "menuitem", { name: "Open Dialog with Autofocus" }),
    );
    await waitFor(() =>
      expect(getByRole(canvas.ownerDocument.body, "textbox", { name: "Username" })).toHaveFocus(),
    );
  },
};

/**
 * Simple dialog opened from a menu item — focus should land on the first footer button.
 */
export const SimpleDialogButtonFocus: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/bitwarden");
    await fireEvent.click(getByRole(canvas, "button", { name: "Open Dialog from Menu" }));
    await fireEvent.click(
      getByRole(canvas.ownerDocument.body, "menuitem", { name: "Open Simple Dialog" }),
    );
    await waitFor(() =>
      expect(getByRole(canvas.ownerDocument.body, "button", { name: "Yes" })).toHaveFocus(),
    );
  },
};
