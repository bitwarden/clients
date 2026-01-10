import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { StepComponent } from "./step.component";
import { StepperComponent } from "./stepper.component";

export default {
  title: "Component Library/Stepper/Step",
  component: StepComponent,
  decorators: [
    moduleMetadata({
      imports: [StepperComponent],
    }),
  ],
} as Meta;

export const Default: StoryObj<StepComponent> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-stepper>
        <bit-step
          label="This is the label"
          subLabel="This is the sub label"
        >
          <p>Your custom step content appears in here. You can add whatever content you'd like</p>
        </bit-step>
    </bit-stepper>
    `,
  }),
};
