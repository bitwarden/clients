import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { VerticalStep } from "./vertical-step.component";
import { VerticalStepperComponent } from "./vertical-stepper.component";

export default {
  title: "Component Library/Vertical Stepper/Vertical Step",
  component: VerticalStep,
  decorators: [
    moduleMetadata({
      imports: [VerticalStepperComponent],
    }),
  ],
} as Meta;

export const Default: StoryObj<VerticalStep> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-vertical-stepper>
        <bit-vertical-step
          label="This is the label"
          subLabel="This is the sub label"
          [applyBorder]="applyBorder"
        >
          <p>Your custom step content appears in here. You can add whatever content you'd like</p>
        </bit-vertical-step>
    </bit-vertical-stepper>
    `,
  }),
  args: {
    applyBorder: true,
  },
};
