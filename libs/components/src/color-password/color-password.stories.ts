import { Meta, StoryObj } from "@storybook/angular";

import { ColorPasswordComponent } from "./color-password.component";

const examplePassword = "Wq$Jk😀7j  DX#rS5Sdi!z ";

export default {
  title: "Component Library/Color Password",
  component: ColorPasswordComponent,
  args: {
    password: examplePassword,
    showCount: false,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21540-46261&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<ColorPasswordComponent>;

export const ColorPassword: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-color-password class="tw-text-base" [password]="password" [showCount]="showCount"></bit-color-password>
    `,
  }),
};

export const WrappedColorPassword: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-max-w-32">
        <bit-color-password class="tw-text-base" [password]="password" [showCount]="showCount"></bit-color-password>
      </div>
    `,
  }),
};

export const ColorPasswordCount: Story = {
  ...ColorPassword,
  args: {
    password: examplePassword,
    showCount: true,
  },
};

export const WrappedColorPasswordCount: Story = {
  ...WrappedColorPassword,
  args: {
    password: examplePassword,
    showCount: true,
  },
};
