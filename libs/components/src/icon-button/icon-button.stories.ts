import { Meta, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";

import { BitIconButtonComponent } from "./icon-button.component";

export default {
  title: "Component Library/Icon Button",
  component: BitIconButtonComponent,
  args: {
    bitIconButton: "bwi-plus",
    label: "Your button label here",
  },
  argTypes: {
    buttonType: {
      options: ["primary", "secondary", "danger", "unstyled", "contrast", "main", "muted", "light"],
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-37011&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta<BitIconButtonComponent>;

type Story = StoryObj<BitIconButtonComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <button type="button" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}>Button</button>
    `,
  }),
};

export const Small: Story = {
  ...Default,
  args: {
    size: "small",
    buttonType: "primary",
  },
};

export const Primary: Story = {
  ...Default,
  args: {
    buttonType: "primary",
  },
};

export const Danger: Story = {
  ...Default,
  args: {
    buttonType: "danger",
  },
};

export const Main: Story = {
  ...Default,
  args: {
    buttonType: "main",
  },
};

export const Muted: Story = {
  ...Default,
  args: {
    buttonType: "muted",
  },
};

export const NavContrast: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-bg-background-alt3 tw-p-6 tw-w-full tw-inline-block">
      <!-- <div> used only to provide dark background color -->
      <button type="button" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}>Button</button>
    </div>
      `,
  }),
  args: {
    buttonType: "nav-contrast",
  },
};

export const Contrast: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-bg-primary-600 tw-p-6 tw-w-full tw-inline-block">
      <!-- <div> used only to provide dark background color -->
      <button type="button" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}>Button</button>
    </div>
      `,
  }),
  args: {
    buttonType: "contrast",
  },
};

export const Loading: Story = {
  ...Default,
  args: {
    disabled: false,
    loading: true,
  },
};

export const Disabled: Story = {
  ...Default,
  args: {
    disabled: true,
    loading: false,
  },
};
