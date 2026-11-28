import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import { expect, waitFor } from "storybook/test";

import "./input";

export default {
  title: "Component Library/Form/Autofocus Directive",
  component: "bit-input",
  parameters: {
    docs: {
      description: {
        component:
          "Fields with the `autofocus` attribute focus themselves once, when first rendered (skipped on mobile browsers). Works for fields added later too, e.g. in dialogs.",
      },
    },
  },
} satisfies Meta;

export const AutofocusField: StoryObj = {
  render: () => html`<bit-input label="Email" autofocus></bit-input>`,
  play: async ({ canvasElement }) => {
    const field = canvasElement.querySelector("bit-input")!;
    await waitFor(() => expect(field.shadowRoot?.activeElement?.localName).toBe("input"));
  },
};
