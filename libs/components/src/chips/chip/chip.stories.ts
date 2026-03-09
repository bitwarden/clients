import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../../utils";
import { sharedArgTypes, sizeArgType } from "../shared/shared-story-arg-types";

import { ChipComponent } from "./chip.component";

export default {
  title: "Component Library/Chips/Chip",
  component: ChipComponent,
  decorators: [
    moduleMetadata({
      imports: [ChipComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              removeItem: (name) => `Remove ${name}`,
            });
          },
        },
      ],
    }),
  ],
  args: {
    disabled: false,
    label: "Chip Label",
  },
  argTypes: {
    ...sharedArgTypes,
    ...sizeArgType,
  },
} as Meta;

type Story = StoryObj;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-chip 
        [disabled]="disabled"
        [startIcon]="startIcon"
        [label]="label"
        [size]="size"
      >
      </bit-chip>
    `,
  }),
  args: {
    startIcon: "bwi-filter",
  },
};

export const Inactive: Story = {
  ...Default,
  args: {
    ...Default.args,
    startIcon: "bwi-filter",
    disabled: true,
  },
};

export const Small: Story = {
  ...Default,
  args: {
    ...Default.args,
    startIcon: "bwi-filter",
    size: "small",
  },
};

export const WithLongLabel: Story = {
  ...Default,
  args: {
    ...Default.args,
    startIcon: "bwi-filter",
    label: "This is a chip with a very long label that should truncate",
  },
};
