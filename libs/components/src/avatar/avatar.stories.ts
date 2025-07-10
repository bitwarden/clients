import { Meta, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";

import { AvatarComponent } from "./avatar.component";

export default {
  title: "Component Library/Avatar",
  component: AvatarComponent,
  args: {
    id: undefined,
    text: "Walt Walterson",
    size: "default",
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-26525&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<AvatarComponent>;

export const Default: Story = {
  render: (args) => {
    return {
      props: args,
      template: `
        <bit-avatar ${formatArgsForCodeSnippet<AvatarComponent>(args)}></bit-avatar>
      `,
    };
  },
  args: {
    color: "#175ddc",
  },
};

export const Large: Story = {
  ...Default,
  args: {
    size: "large",
  },
};

export const Small: Story = {
  ...Default,
  args: {
    size: "small",
  },
};

export const LightBackground: Story = {
  ...Default,
  args: {
    color: "#d2ffcf",
  },
};

export const Border: Story = {
  ...Default,
  args: {
    border: true,
  },
};

export const ColorByID: Story = {
  ...Default,
  args: {
    id: "236478",
  },
};

export const ColorByText: Story = {
  ...Default,
  args: {
    text: "Jason Doe",
  },
};
