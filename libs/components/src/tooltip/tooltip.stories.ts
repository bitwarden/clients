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
    chromatic: {
      // Allows 30% difference for the tooltip stories since they are rendered in a portal and may be affected by the environment.
      diffThreshold: 0.3,
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
    tooltipPosition: "above-center",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-p-4">
        <button
          bitIconButton="bwi-ellipsis-v"
          label="Your tooltip content here"
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
    parameters: {
      chromatic: { disableSnapshot: true },
    },
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
    parameters: {
      chromatic: { disableSnapshot: true },
    },
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
    parameters: {
      chromatic: { disableSnapshot: true },
    },
    template: `
      <div class="tw-p-16 tw-flex tw-items-center tw-justify-center">
        <button
          bitIconButton="bwi-ellipsis-v"
          label="Tooltip on disabled button"
          [disabled]="true"
        ></button>
      </div>
    `,
  }),
};

export const OnNonIconButton: Story = {
  render: () => ({
    parameters: {
      chromatic: { disableSnapshot: true },
    },
    template: `
      <div class="tw-p-16 tw-flex tw-items-center tw-justify-center">
        <button
          bitButton
          addTooltipToDescribedby="true"
          bitTooltip="Some additional tooltip text to describe the button"
        >Button label</button>
      </div>
    `,
  }),
};
