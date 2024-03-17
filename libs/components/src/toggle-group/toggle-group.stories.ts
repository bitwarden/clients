import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { BadgeModule } from "../badge";

import { ToggleGroupComponent } from "./toggle-group.component";
import { ToggleComponent } from "./toggle.component";

export default {
  title: "Component Library/Toggle Group",
  component: ToggleGroupComponent,
  args: {
    selected: "all",
  },
  decorators: [
    moduleMetadata({
      declarations: [ToggleGroupComponent, ToggleComponent],
      imports: [BadgeModule],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=1881%3A17157",
    },
  },
} as Meta;

type Story = StoryObj<ToggleGroupComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-toggle-group [(selected)]="selected" aria-label="People list filter">
        <bit-toggle value="all"> All <span bitBadge variant="info">3</span> </bit-toggle>

        <bit-toggle value="invited"> Invited </bit-toggle>

        <bit-toggle value="accepted"> Accepted <span bitBadge variant="info">2</span> </bit-toggle>

        <bit-toggle value="deactivated"> Deactivated </bit-toggle>
      </bit-toggle-group>
    `,
  }),
  args: {
    selected: "all",
  },
};
