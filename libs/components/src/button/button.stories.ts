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
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=5115%3A26950",
    },
  },
} as Meta<ButtonComponent>;

type Story = StoryObj<ButtonComponent>;

export const Primary: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block">Button</button>
      <a bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [block]="block" href="#" class="tw-ml-2">Link</a>
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
      <ng-container *ngIf="disabled">
        <button bitButton disabled [loading]="loading" [block]="block" buttonType="primary" class="tw-mr-2">Primary</button>
        <button bitButton disabled [loading]="loading" [block]="block" buttonType="secondary" class="tw-mr-2">Secondary</button>
        <button bitButton disabled [loading]="loading" [block]="block" buttonType="danger" class="tw-mr-2">Danger</button>
      </ng-container>
      <ng-container *ngIf="!disabled">
        <button bitButton [loading]="loading" [block]="block" buttonType="primary" class="tw-mr-2">Primary</button>
        <button bitButton [loading]="loading" [block]="block" buttonType="secondary" class="tw-mr-2">Secondary</button>
        <button bitButton [loading]="loading" [block]="block" buttonType="danger" class="tw-mr-2">Danger</button>
      </ng-container>
    `,
  }),
  args: {
    disabled: true,
    loading: false,
  },
};
