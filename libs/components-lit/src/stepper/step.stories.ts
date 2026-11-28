import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./step";
import "./stepper";

export default {
  title: "Component Library/Stepper/Step",
  component: "bit-step",
} satisfies Meta;

export const Default: StoryObj = {
  render: () => html`
    <bit-stepper>
      <bit-step label="This is the label" sub-label="This is the sub label">
        <p>Your custom step content appears in here. You can add whatever content you'd like</p>
      </bit-step>
    </bit-stepper>
  `,
};
