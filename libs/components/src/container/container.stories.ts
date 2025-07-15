import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { ContainerComponent } from "./container.component";

export default {
  title: "Component Library/Container",
  component: ContainerComponent,
  decorators: [
    moduleMetadata({
      imports: [ContainerComponent],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-47329&t=k6OTDDPZOTtypRqo-11",
    },
  },
} as Meta<ContainerComponent>;

type Story = StoryObj<ContainerComponent>;

export const Container: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-container>
        bit-container is a minimally styled component that limits the max width of it's content to the tailwind theme variable '4xl'. '4xl' is equal to the value of 56rem
      </bit-container>
    `,
  }),
};
