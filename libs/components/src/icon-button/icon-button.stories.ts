import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { ButtonType, ButtonTypes } from "../shared/button-like.abstraction";
import { I18nMockService } from "../utils";

import { BitIconButtonComponent, IconButtonSize } from "./icon-button.component";

export default {
  title: "Component Library/Icon Button",
  component: BitIconButtonComponent,
  decorators: [
    moduleMetadata({
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
    bitIconButton: "bwi-plus",
    label: "Your button label here",
  },
  argTypes: {
    bitIconButton: {
      control: { type: "text" },
      description: "The icon class to display",
      table: {
        type: { summary: "string" },
      },
    },
    label: {
      control: { type: "text" },
      description: "Accessible label for screen readers and tooltip content",
      table: {
        type: { summary: "string" },
      },
    },
    buttonType: {
      options: Object.values(ButtonTypes),
      control: { type: "select" },
      description: "The visual style variant of the icon button",
      table: {
        type: { summary: "ButtonType" },
        defaultValue: { summary: "secondary" },
      },
    },
    size: {
      options: ["small", "default"],
      control: { type: "radio" },
      description: "The size of the icon button",
      table: {
        type: { summary: '"small" | "default"' },
        defaultValue: { summary: "default" },
      },
    },
    loading: {
      control: { type: "boolean" },
      description: "Whether the icon button is in a loading state",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: { type: "boolean" },
      description: "Whether the icon button is disabled",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-37011&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta<BitIconButtonComponent>;

// Extend BitIconButtonComponent type to include host directive inputs for Storybook
type BitIconButtonComponentWithHostDirectiveInputs = BitIconButtonComponent & {
  buttonType: ButtonType;
  size: IconButtonSize;
  loading: boolean;
  disabled: boolean;
};

type Story = StoryObj<BitIconButtonComponentWithHostDirectiveInputs>;

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

export const Secondary: Story = {
  ...Default,
  args: {
    buttonType: "secondary",
  },
};

export const Subtle: Story = {
  ...Default,
  args: {
    buttonType: "subtle",
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
