import { signal } from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { getByRole, userEvent } from "@storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonComponent } from "../button";
import { BitIconButtonComponent } from "../icon-button";
import { I18nMockService } from "../utils";

import { TooltipPosition, TooltipPositionIdentifier, tooltipPositions } from "./tooltip-positions";
import { TOOLTIP_DATA, TooltipComponent } from "./tooltip.component";
import { TooltipDirective } from "./tooltip.directive";

import { formatArgsForCodeSnippet } from ".storybook/format-args-for-code-snippet";

export default {
  title: "Component Library/Tooltip",
  component: TooltipDirective,
  decorators: [
    moduleMetadata({
      imports: [TooltipDirective, TooltipComponent, BitIconButtonComponent, ButtonComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              loading: "Loading",
            });
          },
        },
        {
          provide: TOOLTIP_DATA,
          useFactory: () => {
            // simple fixed demo values for the Default story
            return {
              content: signal("This is a tooltip"),
              isVisible: signal(true),
              tooltipPosition: signal<TooltipPositionIdentifier>("above-center"),
            };
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?m=auto&node-id=30558-13730&t=4k23PtzCwqDekAZW-1",
    },
  },
  argTypes: {
    bitTooltip: {
      control: "text",
      description: "Text content of the tooltip",
    },
    tooltipPosition: {
      control: "select",
      options: tooltipPositions.map((position: TooltipPosition) => position.id),
      description: "Position of the tooltip relative to the element",
      table: {
        type: {
          summary: tooltipPositions.map((position: TooltipPosition) => position.id).join(" | "),
        },
        defaultValue: { summary: "above-center" },
      },
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
        <button
          bitIconButton="bwi-ellipsis-v"
          ${formatArgsForCodeSnippet<TooltipDirective>(args)}
        >
          Button label here
        </button>
      </div>
    `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.hover(button);
  },
};

export const AllPositions: Story = {
  render: () => ({
    template: `
      <div class="tw-p-16 tw-grid tw-grid-cols-2 tw-gap-8 tw-place-items-center">
        <button
          bitIconButton="bwi-angle-up"
          bitTooltip="Top tooltip"
          tooltipPosition="above-center"
        ></button>
        <button
          bitIconButton="bwi-angle-right"
          bitTooltip="Right tooltip"
          tooltipPosition="right-center"
        ></button>
        <button
          bitIconButton="bwi-angle-left"
          bitTooltip="Left tooltip"
          tooltipPosition="left-center"
        ></button>
        <button
          bitIconButton="bwi-angle-down"
          bitTooltip="Bottom tooltip"
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
          bitTooltip="This is a very long tooltip that will wrap to multiple lines to demonstrate how the tooltip handles long content. This is not recommended for usability."
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
