import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { ChipComponent } from "./chip.component";
import { sharedArgTypes } from "./shared-story-arg-types";

export default {
  title: "Component Library/Chip",
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
  },
} as Meta<ChipComponent>;

type Story = StoryObj<ChipComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-chip 
        [disabled]="disabled"
        [startIcon]="startIcon"
        [label]="label"
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
