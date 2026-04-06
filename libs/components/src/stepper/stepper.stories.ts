import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { ButtonComponent } from "../button";

import { StepComponent } from "./step.component";
import { StepperComponent } from "./stepper.component";

export default {
  title: "Component Library/Stepper",
  component: StepperComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonComponent, StepComponent],
    }),
  ],
} as Meta;

export const Default: StoryObj<StepperComponent> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-stepper [orientation]="orientation">
        <bit-step
          label="This is the label"
          subLabel="This is the sub label"
        >
          <p>Your custom step content appears in here. You can add whatever content you'd like</p>
          <button
              type="button"
              bitButton
              buttonType="primary"
            >
              Some button label
            </button>
        </bit-step>
        <bit-step
            label="Another label"
        >
            <p>Another step</p>
            <button
              type="button"
              bitButton
              buttonType="primary"
            >
              Some button label
            </button>
        </bit-step>
        <bit-step
            label="The last label"
        >
            <p>The last step</p>
            <button
                type="button"
                bitButton
                buttonType="primary"
            >
            Some button label
            </button>
        </bit-step>
    </bit-stepper>
    `,
  }),
};

export const Horizontal: StoryObj<StepperComponent> = {
  ...Default,
  args: {
    orientation: "horizontal",
  },
};
