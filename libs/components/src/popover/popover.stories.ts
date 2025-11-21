import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { getByRole, userEvent } from "@storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { SharedModule } from "../shared/shared.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { PopoverTriggerForDirective } from "./popover-trigger-for.directive";
import { PopoverModule } from "./popover.module";

export default {
  title: "Component Library/Popover",
  decorators: [
    moduleMetadata({
      imports: [PopoverModule, ButtonModule, IconButtonModule, SharedModule, LinkModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40852&t=b5tDKylm5sWm2yKo-4",
    },
    // TODO fix flakiness of popover positioning https://bitwarden.atlassian.net/browse/CL-822
    chromatic: {
      disableSnapshot: true,
    },
  },
  argTypes: {
    position: {
      options: [
        "right-start",
        "right-center",
        "right-end",
        "left-start",
        "left-center",
        "left-end",
        "below-start",
        "below-center",
        "below-end",
        "above-start",
        "above-center",
        "above-end",
      ],
      control: { type: "select" },
    },
  },
  args: {
    position: "right-start",
  },
} as Meta;

type Story = StoryObj<PopoverTriggerForDirective>;

const popoverContent = /*html*/ `
  <bit-popover [title]="'Example Title'" #myPopover>
    <div>Lorem ipsum dolor <a href="#" bitLink>adipisicing elit</a>.</div>
    <ul class="tw-mt-2 tw-mb-0 tw-ps-4">
      <li>Dolor sit amet consectetur</li>
      <li>Esse labore veniam tempora</li>
      <li>Adipisicing elit ipsum <a href="#" bitLink>iustolaborum</a></li>
    </ul>
    <button type="button" bitButton class="tw-mt-4" (click)="triggerRef.closePopover()">Close</button>
  </bit-popover>
`;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-mt-44 tw-h-[400px]">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          aria-label="Open popover"
          title="Open popover"
          bitLink
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const OpenLongTitle: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          aria-label="Open popover"
          title="Open popover"
          bitLink
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>

      <bit-popover [title]="'Example Title that is really long it wraps 2 lines'" #myPopover>
        <div>Lorem ipsum dolor <a href="#" bitLink>adipisicing elit</a>.</div>
        <ul class="tw-mt-2 tw-ps-4">
          <li>Dolor sit amet consectetur</li>
          <li>Esse labore veniam tempora</li>
          <li>Adipisicing elit ipsum <a href="#" bitLink>iustolaborum</a></li>
        </ul>
        <p class="tw-mb-0">Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
      </bit-popover>
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const RightStart: Story = {
  args: {
    position: "right-start",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
          aria-label="Open popover"
          title="Open popover"
          bitLink
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const RightCenter: Story = {
  args: {
    position: "right-center",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
          aria-label="Open popover"
          title="Open popover"
          bitLink
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const RightEnd: Story = {
  args: {
    position: "right-end",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
          aria-label="Open popover"
          title="Open popover"
          bitLink
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const LeftStart: Story = {
  args: {
    position: "left-start",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <div class="tw-flex tw-justify-end">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600"
            [bitPopoverTriggerFor]="myPopover"
            #triggerRef="popoverTrigger"
            [position]="'${args.position}'"
            aria-label="Open popover"
            title="Open popover"
            bitLink
          >
            <i class="bwi bwi-question-circle"></i>
          </button>
        </div>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const LeftCenter: Story = {
  args: {
    position: "left-center",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <div class="tw-flex tw-justify-end">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600"
            [bitPopoverTriggerFor]="myPopover"
            #triggerRef="popoverTrigger"
            [position]="'${args.position}'"
            aria-label="Open popover"
            title="Open popover"
            bitLink
          >
            <i class="bwi bwi-question-circle"></i>
          </button>
        </div>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};
export const LeftEnd: Story = {
  args: {
    position: "left-end",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <div class="tw-flex tw-justify-end">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600"
            [bitPopoverTriggerFor]="myPopover"
            #triggerRef="popoverTrigger"
            [position]="'${args.position}'"
            aria-label="Open popover"
            title="Open popover"
            bitLink
          >
            <i class="bwi bwi-question-circle"></i>
          </button>
        </div>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const BelowStart: Story = {
  args: {
    position: "below-start",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600"
            [bitPopoverTriggerFor]="myPopover"
            #triggerRef="popoverTrigger"
            [position]="'${args.position}'"
            aria-label="Open popover"
            title="Open popover"
            bitLink
          >
            <i class="bwi bwi-question-circle"></i>
          </button>
        </div>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const BelowCenter: Story = {
  args: {
    position: "below-center",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600"
            [bitPopoverTriggerFor]="myPopover"
            #triggerRef="popoverTrigger"
            [position]="'${args.position}'"
            aria-label="Open popover"
            title="Open popover"
            bitLink
          >
            <i class="bwi bwi-question-circle"></i>
          </button>
        </div>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const BelowEnd: Story = {
  args: {
    position: "below-end",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600"
            [bitPopoverTriggerFor]="myPopover"
            #triggerRef="popoverTrigger"
            [position]="'${args.position}'"
            aria-label="Open popover"
            title="Open popover"
            bitLink
          >
            <i class="bwi bwi-question-circle"></i>
          </button>
        </div>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const AboveStart: Story = {
  args: {
    position: "above-start",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600"
            [bitPopoverTriggerFor]="myPopover"
            #triggerRef="popoverTrigger"
            [position]="'${args.position}'"
            aria-label="Open popover"
            title="Open popover"
            bitLink
          >
            <i class="bwi bwi-question-circle"></i>
          </button>
        </div>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const AboveCenter: Story = {
  args: {
    position: "above-center",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600"
            [bitPopoverTriggerFor]="myPopover"
            #triggerRef="popoverTrigger"
            [position]="'${args.position}'"
            aria-label="Open popover"
            title="Open popover"
            bitLink
          >
            <i class="bwi bwi-question-circle"></i>
          </button>
        </div>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};

export const AboveEnd: Story = {
  args: {
    position: "above-end",
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[400px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600"
            [bitPopoverTriggerFor]="myPopover"
            #triggerRef="popoverTrigger"
            [position]="'${args.position}'"
            aria-label="Open popover"
            title="Open popover"
            bitLink
          >
            <i class="bwi bwi-question-circle"></i>
          </button>
        </div>
      </div>
      ${popoverContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");

    await userEvent.click(button);
  },
};
