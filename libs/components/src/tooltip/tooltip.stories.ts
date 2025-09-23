import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { ButtonComponent } from "../button";
import { BitIconButtonComponent } from "../icon-button";
import {
  getDefaultPositions,
  DefaultPosition,
  ALLOWED_TOOLTIP_POSITION_IDS,
} from "../utils/default-positions";

import { TooltipComponent } from "./tooltip.component";
import { TooltipDirective } from "./tooltip.directive";

import { formatArgsForCodeSnippet } from ".storybook/format-args-for-code-snippet";

export default {
  title: "Component Library/Tooltip",
  component: TooltipComponent,
  decorators: [
    moduleMetadata({
      imports: [TooltipComponent, BitIconButtonComponent, ButtonComponent],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "YOUR_FIGMA_URL_HERE",
    },
  },
  argTypes: {
    bitTooltip: {
      control: "text",
      description: "Text content of the tooltip",
    },
    tooltipPosition: {
      control: "select",
      options: getDefaultPositions("bit-tooltip")
        .filter((position: DefaultPosition) => ALLOWED_TOOLTIP_POSITION_IDS.includes(position.id))
        .map((position: DefaultPosition) => position.id),
      description: "Position of the tooltip relative to the element",
    },
  },
} as Meta<TooltipDirective>;

type Story = StoryObj<TooltipDirective>;

export const Default: Story = {
  args: {
    bitTooltip: "This is a tooltip",
    tooltipPosition: "above-center",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-p-4">
        <bit-tooltip content="This is a tooltip" isVisible="true" />
      </div>
    `,
  }),
};

export const BasicUsage: Story = {
  args: {
    tooltipPosition: "above-center",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-p-4">
        <button
          bitIconButton="bwi-ellipsis-v"
          label="More options"
          ${formatArgsForCodeSnippet<TooltipDirective>(args)}
        >
          Button label here
        </button>
      </div>
    `,
  }),
};

export const AllPositions: Story = {
  render: () => ({
    template: `
      <div class="tw-p-16 tw-grid tw-grid-cols-2 tw-gap-8 tw-place-items-center">
        <button
          bitIconButton="bwi-angle-up"
          label="Top tooltip"
          tooltipPosition="above-center"
        ></button>
        <button
          bitIconButton="bwi-angle-right"
          label="Right tooltip"
          tooltipPosition="right-center"
        ></button>
        <button
          bitIconButton="bwi-angle-left"
          label="Left tooltip"
          tooltipPosition="left-center"
        ></button>
        <button
          bitIconButton="bwi-angle-down"
          label="Bottom tooltip"
          tooltipPosition="below-center"
        ></button>
      </div>
    `,
  }),
};

export const LongContent: Story = {
  render: () => ({
    template: `
      <div class="tw-p-16 tw-flex tw-items-center tw-justify-center">
        <button
          bitIconButton="bwi-ellipsis-v"
          label="This is a very long tooltip that will wrap to multiple lines to demonstrate how the tooltip handles long content. This is not recommended for usability."
        ></button>
      </div>
    `,
  }),
};

export const OnDisabledButton: Story = {
  render: () => ({
    template: `
      <div class="tw-p-16 tw-flex tw-items-center tw-justify-center">
        <button
          bitIconButton="bwi-ellipsis-v"
          bitTooltip="Tooltip on disabled button"
          [disabled]="true"
        ></button>
      </div>
    `,
  }),
};
