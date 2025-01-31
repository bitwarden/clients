import { Meta, StoryObj } from "@storybook/angular";

import { BitIconButtonComponent } from "./icon-button.component";

export default {
  title: "Component Library/Icon Button",
  component: BitIconButtonComponent,
  args: {
    bitIconButton: "bwi-plus",
    size: "default",
    disabled: false,
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
    <div class="tw-space-x-4">
      <button bitIconButton="bwi-plus" [disabled]="disabled" [loading]="loading" buttonType="main" [size]="size">Button</button>
      <button bitIconButton="bwi-plus" [disabled]="disabled" [loading]="loading" buttonType="muted" [size]="size">Button</button>
      <button bitIconButton="bwi-plus" [disabled]="disabled" [loading]="loading" buttonType="primary" [size]="size">Button</button>
      <button bitIconButton="bwi-plus" [disabled]="disabled" [loading]="loading" buttonType="secondary"[size]="size">Button</button>
      <button bitIconButton="bwi-plus" [disabled]="disabled" [loading]="loading" buttonType="danger" [size]="size">Button</button>
      <div class="tw-bg-primary-600 tw-p-2 tw-inline-block">
        <button bitIconButton="bwi-plus" [disabled]="disabled" [loading]="loading" buttonType="contrast" [size]="size">Button</button>
      </div>
      <div class="tw-bg-background-alt2 tw-p-2 tw-inline-block">
        <button bitIconButton="bwi-plus" [disabled]="disabled" [loading]="loading" buttonType="light" [size]="size">Button</button>
      </div>
    </div>
    `,
  }),
  args: {
    size: "default",
    buttonType: "primary",
  },
};

export const Small: Story = {
  ...Default,
  args: {
    size: "small",
    buttonType: "primary",
  },
};

export const Primary: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <button bitIconButton="bwi-plus" [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size">Button</button>
    `,
  }),
  args: {
    buttonType: "primary",
  },
};

export const Secondary: Story = {
  ...Primary,
  args: {
    buttonType: "secondary",
  },
};

export const Danger: Story = {
  ...Primary,
  args: {
    buttonType: "danger",
  },
};

export const Main: Story = {
  ...Primary,
  args: {
    buttonType: "main",
  },
};

export const Muted: Story = {
  ...Primary,
  args: {
    buttonType: "muted",
  },
};

export const Light: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-bg-background-alt2 tw-p-6 tw-w-full tw-inline-block">
      <button bitIconButton="bwi-plus" [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size">Button</button>
    </div>
      `,
  }),
  args: {
    buttonType: "light",
  },
};

export const Contrast: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-bg-primary-600 tw-p-6 tw-w-full tw-inline-block">
      <button bitIconButton="bwi-plus" [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size">Button</button>
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
