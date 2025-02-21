import { Meta, StoryObj } from "@storybook/angular";

import { ButtonComponent } from "./button.component";

export default {
  title: "Component Library/Button",
  component: ButtonComponent,
  args: {
    buttonType: "primary",
    disabled: false,
    loading: false,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-28224&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta<ButtonComponent>;

type Story = StoryObj<ButtonComponent>;

export const Primary: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-flex tw-gap-4 tw-mb-6">
      <button bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block">Button</button>
      <button bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block" class="tw-test-hover">Button:hover</button>
      <button bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block" class="tw-test-focus-visible">Button:focus-visible</button>
      <button bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block" class="tw-test-hover tw-test-focus-visible">Button:hover:focus-visible</button>
      <button bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block" class="tw-test-active">Button:active</button>
    </div>
    <div class="tw-flex tw-gap-4">
      <a href="#" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block">Anchor</a>
      <a href="#" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block" class="tw-test-hover">Anchor:hover</a>
      <a href="#" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block" class="tw-test-focus-visible">Anchor:focus-visible</a>
      <a href="#" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block" class="tw-test-hover tw-test-focus-visible">Anchor:hover:focus-visible</a>
      <a href="#" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block" class="tw-test-active">Anchor:active</a>
    </div>
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

export const Loading: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitButton [disabled]="disabled" [loading]="loading" [block]="block" buttonType="primary" class="tw-mr-2">Primary</button>
      <button bitButton [disabled]="disabled" [loading]="loading" [block]="block" buttonType="secondary" class="tw-mr-2">Secondary</button>
      <button bitButton [disabled]="disabled" [loading]="loading" [block]="block" buttonType="danger" class="tw-mr-2">Danger</button>
    `,
  }),
  args: {
    disabled: false,
    loading: true,
  },
};

export const Disabled: Story = {
  ...Loading,
  args: {
    disabled: true,
    loading: false,
  },
};

export const DisabledWithAttribute: Story = {
  render: (args) => ({
    props: args,
    template: `
      @if (disabled) {
        <button bitButton disabled [loading]="loading" [block]="block" buttonType="primary" class="tw-mr-2">Primary</button>
        <button bitButton disabled [loading]="loading" [block]="block" buttonType="secondary" class="tw-mr-2">Secondary</button>
        <button bitButton disabled [loading]="loading" [block]="block" buttonType="danger" class="tw-mr-2">Danger</button>
      } @else {
        <button bitButton [loading]="loading" [block]="block" buttonType="primary" class="tw-mr-2">Primary</button>
        <button bitButton [loading]="loading" [block]="block" buttonType="secondary" class="tw-mr-2">Secondary</button>
        <button bitButton [loading]="loading" [block]="block" buttonType="danger" class="tw-mr-2">Danger</button>
      }
    `,
  }),
  args: {
    disabled: true,
    loading: false,
  },
};

export const Block: Story = {
  render: (args) => ({
    props: args,
    template: `
      <span class="tw-flex">
        <button bitButton [buttonType]="buttonType" [block]="block">[block]="true" Button</button>
        <a bitButton [buttonType]="buttonType" [block]="block" href="#" class="tw-ml-2">[block]="true" Link</a>

        <button bitButton [buttonType]="buttonType" block class="tw-ml-2">block Button</button>
        <a bitButton [buttonType]="buttonType" block href="#" class="tw-ml-2">block Link</a>
      </span>
    `,
  }),
  args: {
    block: true,
  },
};
