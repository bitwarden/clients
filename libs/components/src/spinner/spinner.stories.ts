import { CommonModule } from "@angular/common";
import { Meta, moduleMetadata, Story } from "@storybook/angular";

import { SpinnerComponent } from "./spinner.component";

export default {
  title: "Component Library/Spinner",
  component: SpinnerComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      declarations: [],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=1881%3A16956",
    },
  },
} as Meta;

const Template: Story<SpinnerComponent> = (args: SpinnerComponent) => ({
  props: args,
});

export const Primary = Template.bind({});
Primary.args = {
  size: "large",
};
