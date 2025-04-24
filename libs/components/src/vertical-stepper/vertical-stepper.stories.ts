import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { ButtonComponent } from "../button";

import { VerticalStep } from "./vertical-step.component";
import { VerticalStepperComponent } from "./vertical-stepper.component";

export default {
  title: "Component Library/Vertical Stepper",
  component: VerticalStepperComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonComponent, VerticalStep],
    }),
  ],
} as Meta;

export const Default: StoryObj<VerticalStepperComponent> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-vertical-stepper #stepper>
        <bit-vertical-step
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
        </bit-vertical-step>
        <bit-vertical-step
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
        </bit-vertical-step>
        <bit-vertical-step
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
        </bit-vertical-step>
    </bit-vertical-stepper>
    `,
  }),
};
