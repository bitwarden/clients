import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconComponent } from "../../icon/icon.component";
import { I18nMockService } from "../../utils";
import { ChipDismissButtonComponent } from "../shared/chip-dismiss-button.component";
import { sharedArgTypes, sizeArgType } from "../shared/shared-story-arg-types";

import { ChipComponent } from "./chip.component";

export default {
  title: "Component Library/Chips/Chip",
  component: ChipComponent,
  decorators: [
    moduleMetadata({
      imports: [ChipComponent, ChipDismissButtonComponent, IconComponent],
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

/**
 * Helper classes for chip wrapper styling, matching what BaseChipDirective produces
 * for the primary variant at each size. Used to manually construct chips in the
 * InteractionStates story so that `tw-test-hover` / `tw-test-focus-visible` can be
 * applied directly to the dismiss button element.
 */
const chipWrapperLarge =
  "tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-md tw-border tw-font-medium tw-transition-colors " +
  "tw-bg-bg-brand-softer tw-border-border-brand-soft tw-text-fg-brand-strong " +
  "tw-text-sm/5 tw-ps-2 tw-py-[calc(theme(spacing.1)_-_1px)] tw-pe-1 tw-max-w-52";

const chipWrapperSmall =
  "tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-border tw-font-medium tw-transition-colors " +
  "tw-bg-bg-brand-softer tw-border-border-brand-soft tw-text-fg-brand-strong " +
  "tw-text-xs/4 tw-ps-1.5 tw-py-[calc(theme(spacing[0.5])_-_1px)] tw-pe-0.5 tw-max-w-52";

export const InteractionStates: Story = {
  render: () => ({
    props: {
      chipWrapperLarge,
      chipWrapperSmall,
    },
    template: /* html */ `
      <div class="tw-flex tw-flex-col tw-gap-6">
        <div class="tw-flex tw-items-center tw-gap-6">
          <span class="tw-text-sm tw-text-fg-body tw-w-24">Default</span>
          <bit-chip label="Chip Label" startIcon="bwi-filter"></bit-chip>
          <bit-chip label="Chip Label" startIcon="bwi-filter" size="small"></bit-chip>
        </div>

        <div class="tw-flex tw-items-center tw-gap-6">
          <span class="tw-text-sm tw-text-fg-body tw-w-24">Hover</span>
          <div [class]="chipWrapperLarge">
            <bit-icon name="bwi-filter" class="tw-text-base/5"></bit-icon>
            <span class="tw-text-start tw-truncate tw-leading-5 tw-min-w-0 tw-flex-1">Chip Label</span>
            <button bit-chip-dismiss-button type="button" aria-label="Remove Chip Label" class="tw-test-hover"></button>
          </div>
          <div [class]="chipWrapperSmall">
            <bit-icon name="bwi-filter" class="tw-text-base/5"></bit-icon>
            <span class="tw-text-start tw-truncate tw-min-w-0 tw-flex-1">Chip Label</span>
            <button bit-chip-dismiss-button type="button" aria-label="Remove Chip Label" [size]="'small'" class="tw-test-hover"></button>
          </div>
        </div>

        <div class="tw-flex tw-items-center tw-gap-6">
          <span class="tw-text-sm tw-text-fg-body tw-w-24">Focus</span>
          <div [class]="chipWrapperLarge">
            <bit-icon name="bwi-filter" class="tw-text-base/5"></bit-icon>
            <span class="tw-text-start tw-truncate tw-leading-5 tw-min-w-0 tw-flex-1">Chip Label</span>
            <button bit-chip-dismiss-button type="button" aria-label="Remove Chip Label" class="tw-test-focus-visible"></button>
          </div>
          <div [class]="chipWrapperSmall">
            <bit-icon name="bwi-filter" class="tw-text-base/5"></bit-icon>
            <span class="tw-text-start tw-truncate tw-min-w-0 tw-flex-1">Chip Label</span>
            <button bit-chip-dismiss-button type="button" aria-label="Remove Chip Label" [size]="'small'" class="tw-test-focus-visible"></button>
          </div>
        </div>

        <div class="tw-flex tw-items-center tw-gap-6">
          <span class="tw-text-sm tw-text-fg-body tw-w-24">Inactive</span>
          <bit-chip label="Chip Label" startIcon="bwi-filter" [disabled]="true"></bit-chip>
          <bit-chip label="Chip Label" startIcon="bwi-filter" [disabled]="true" size="small"></bit-chip>
        </div>
      </div>
    `,
  }),
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};
