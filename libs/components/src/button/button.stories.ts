import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SpinnerComponent } from "../spinner";
import { I18nMockService } from "../utils";

import { ButtonComponent } from "./button.component";

export default {
  title: "Component Library/Button",
  component: ButtonComponent,
  decorators: [
    moduleMetadata({
      imports: [SpinnerComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
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

export const Block: Story = {
  render: (args: ButtonComponent) => ({
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
