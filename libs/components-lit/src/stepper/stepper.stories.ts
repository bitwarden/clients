import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import type { BitStep } from "./step";
import type { StepperOrientation } from "./stepper";
import "./step";
import "./stepper";
import "../button/button";

type Args = { orientation?: StepperOrientation; linear: boolean };

export default {
  title: "Component Library/Stepper",
  component: "bit-stepper",
  args: { linear: false },
  argTypes: {
    orientation: { control: "radio", options: ["vertical", "horizontal"] },
  },
  render: (args) => html`
    <bit-stepper orientation=${args.orientation ?? nothing} ?linear=${args.linear}>
      <bit-step label="This is the label" sub-label="This is the sub label">
        <p>Your custom step content appears in here. You can add whatever content you'd like</p>
        <bit-button button-type="primary">Some button label</bit-button>
      </bit-step>
      <bit-step label="Another label">
        <p>Another step</p>
        <bit-button button-type="primary">Some button label</bit-button>
      </bit-step>
      <bit-step label="The last label">
        <p>The last step</p>
        <bit-button button-type="primary">Some button label</bit-button>
      </bit-step>
    </bit-stepper>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const Horizontal: Story = { args: { orientation: "horizontal" } };

const toggleComplete = (event: Event) => {
  const step = (event.target as HTMLElement).closest("bit-step") as BitStep;
  step.completed = (event.target as HTMLInputElement).checked;
};

/**
 * Buttons with `bit-stepper-next` / `bit-stepper-previous` move between steps. In linear mode a
 * step must be completed (here via the checkbox) before the stepper moves past it.
 */
export const LinearWithNavigation: Story = {
  args: { linear: true },
  render: (args) => html`
    <bit-stepper orientation=${args.orientation ?? nothing} ?linear=${args.linear}>
      <bit-step label="Account" sub-label="Mark this step complete to continue" .completed=${false}>
        <label class="tw-flex tw-items-center tw-gap-2 tw-mb-4 tw-text-main">
          <input type="checkbox" @change=${toggleComplete} /> Step complete
        </label>
        <bit-button button-type="primary" bit-stepper-next>Next</bit-button>
      </bit-step>
      <bit-step label="Details" optional>
        <p class="tw-text-main">This step is optional.</p>
        <div class="tw-flex tw-gap-2">
          <bit-button bit-stepper-previous>Back</bit-button>
          <bit-button button-type="primary" bit-stepper-next>Next</bit-button>
        </div>
      </bit-step>
      <bit-step label="Finish">
        <p class="tw-text-main">Done.</p>
        <bit-button bit-stepper-previous>Back</bit-button>
      </bit-step>
    </bit-stepper>
  `,
};
