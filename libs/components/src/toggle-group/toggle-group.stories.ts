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
      imports: [BadgeModule, ToggleGroupComponent, ToggleComponent],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=1881-17157&t=b5tDKylm5sWm2yKo-4",
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

export const FullWidth: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-toggle-group
        [(selected)]="selected"
        aria-label="People list filter"
        [fullWidth]="fullWidth"
      >
        <bit-toggle value="all"> All <span bitBadge variant="info">3</span> </bit-toggle>

        <bit-toggle value="invited"> Invited </bit-toggle>

        <bit-toggle value="accepted"> Accepted <span bitBadge variant="info">2</span> </bit-toggle>

        <bit-toggle value="deactivated"> Deactivated </bit-toggle>
      </bit-toggle-group>
    `,
  }),
  args: {
    selected: "all",
    fullWidth: true,
  },
};

export const LabelWrap: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <code>fullWidth=false</code>
      <bit-toggle-group
        [(selected)]="selected"
        aria-label="People list filter"
        class="tw-max-w-[500px] tw-overflow-hidden tw-border tw-border-solid tw-border-danger-600 tw-py-3"
      >
        <bit-toggle value="all"> All</bit-toggle>

        <bit-toggle value="invited"> Invited to a cool party with cool people </bit-toggle>

        <bit-toggle value="accepted">
          Accepted the invitation<span bitBadge variant="info">2</span>
        </bit-toggle>

        <bit-toggle value="deactivated">Deactivatedinvitationswraplabel</bit-toggle>
      </bit-toggle-group>
      <br />
      <code>fullWidth=true</code>
      <bit-toggle-group
        [(selected)]="selected"
        aria-label="People list filter"
        class="tw-max-w-[500px] tw-overflow-hidden tw-border tw-border-solid tw-border-danger-600 tw-py-3"
        [fullWidth]="fullWidth"
      >
        <bit-toggle value="all"> All</bit-toggle>

        <bit-toggle value="invited"> Invited to a cool party with cool people </bit-toggle>

        <bit-toggle value="accepted">
          Accepted the invitation<span bitBadge variant="info">2</span>
        </bit-toggle>

        <bit-toggle value="deactivated">Deactivatedinvitationswraplabel</bit-toggle>
      </bit-toggle-group>
    `,
  }),
  args: {
    selected: "all",
    fullWidth: true,
  },
};
