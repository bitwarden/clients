import { signal } from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { getByRole, userEvent } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { IconModule } from "../icon";
import { LinkModule } from "../link";
import { I18nMockService } from "../utils/i18n-mock.service";

import { PopoverAnchorForDirective } from "./popover-anchor-for.directive";
import { PopoverModule } from "./popover.module";

export default {
  title: "Component Library/Popover",
  decorators: [
    moduleMetadata({
      imports: [PopoverModule, ButtonModule, IconModule, LinkModule],
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
    // TODO: fix flakiness of popover positioning https://bitwarden.atlassian.net/browse/CL-822
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

type Story = StoryObj<PopoverAnchorForDirective>;

const withHeaderAndFooterContent = /*html*/ `
  <bit-popover [title]="'We\\'ve just released a new dashboard'" #myPopover>
    <img slot="header" src="https://placehold.co/352x160/e2e8f0/64748b?text=Media+Header" alt="" style="width:100%;height:100%;object-fit:cover;" />
    A new and improved dashboard is now live! Enjoy a smoother, more intuitive experience.
    <div slot="footer">
      <button type="button" bitButton class="tw-mr-3" buttonType="secondary">Read more <bit-icon name="bwi-arrow-right"></bit-icon></button>
      <button type="button" bitButton buttonType="primary">Read more <bit-icon name="bwi-arrow-right"></bit-icon></button>
    </div>
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
      <bit-popover [title]="'We\\'ve just released a new dashboard'" #myPopover>
        A new and improved dashboard is now live! Enjoy a smoother, more intuitive experience.
      </bit-popover>
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const WithFooter: Story = {
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
      <bit-popover [title]="'We\\'ve just released a new dashboard'" #myPopover>
        A new and improved dashboard is now live! Enjoy a smoother, more intuitive experience.
        <div slot="footer">
          <button type="button" bitButton buttonType="secondary">Read more <bit-icon name="bwi-arrow-right"></bit-icon></button>
          <button type="button" bitButton buttonType="primary">Read more <bit-icon name="bwi-arrow-right"></bit-icon></button>
        </div>
      </bit-popover>
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const WithHeader: Story = {
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
      <bit-popover [title]="'We\\'ve just released a new dashboard'" #myPopover>
        <img slot="header" src="https://placehold.co/352x160/e2e8f0/64748b?text=Media+Header" alt="" style="width:100%;height:100%;object-fit:cover;" />
        A new and improved dashboard is now live! Enjoy a smoother, more intuitive experience.
      </bit-popover>
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const WithHeaderAndFooter: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-mt-44 tw-h-[500px]">
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const Stepper: Story = {
  render: () => ({
    props: {
      step: signal(1),
      nextStep() {
        this.step.update((s: number) => s + 1);
      },
      prevStep() {
        this.step.update((s: number) => s - 1);
      },
    },
    template: /*html*/ `
      <div class="tw-mt-44 tw-h-[500px]">
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
      <bit-popover [title]="'We\\'ve just released a new dashboard'" #myPopover>
        <img slot="header" src="https://placehold.co/352x160/e2e8f0/64748b?text=Media+Header" alt="" style="width:100%;height:100%;object-fit:cover;" />
        <p class="tw-mb-2 tw-mt-0">A new and improved dashboard is now live! Enjoy a smoother, more intuitive experience.</p>
        <ul class="tw-list-none tw-ps-0 tw-mb-2 tw-mt-0">
          <li class="tw-flex tw-items-center tw-gap-2 tw-mb-1">
            <bit-icon name="bwi-check" class="tw-text-success-600"></bit-icon>
            Upper &amp; lower case letters
          </li>
          <li class="tw-flex tw-items-center tw-gap-2 tw-mb-1">
            <bit-icon name="bwi-close" class="tw-text-danger-600"></bit-icon>
            A symbol (#$&amp;)
          </li>
          <li class="tw-flex tw-items-center tw-gap-2">
            <bit-icon name="bwi-close" class="tw-text-danger-600"></bit-icon>
            A longer password
          </li>
        </ul>
        <a href="#" bitLink>Learn more <bit-icon name="bwi-arrow-right"></bit-icon></a>
        <div slot="footer" class="tw-flex tw-items-center tw-justify-between tw-w-full">
          <span class="tw-text-sm">{{ step() }} of 5</span>
          <div class="tw-flex tw-items-center tw-gap-2">
            <button type="button" bitButton buttonType="secondary" [disabled]="step() === 1" (click)="prevStep()">Back</button>
            <button
              type="button"
              bitButton
              buttonType="primary"
              (click)="step() < 5 ? nextStep() : triggerRef.closePopover()"
            >{{ step() === 5 ? 'Finish' : 'Next' }}</button>
          </div>
        </div>
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
  args: { position: "right-start" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const RightCenter: Story = {
  args: { position: "right-center" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const RightEnd: Story = {
  args: { position: "right-end" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const LeftStart: Story = {
  args: { position: "left-start" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <div class="tw-flex tw-justify-end">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const LeftCenter: Story = {
  args: { position: "left-center" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <div class="tw-flex tw-justify-end">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const LeftEnd: Story = {
  args: { position: "left-end" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <div class="tw-flex tw-justify-end">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const BelowStart: Story = {
  args: { position: "below-start" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const BelowCenter: Story = {
  args: { position: "below-center" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const BelowEnd: Story = {
  args: { position: "below-end" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const AboveStart: Story = {
  args: { position: "above-start" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const AboveCenter: Story = {
  args: { position: "above-center" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};

export const AboveEnd: Story = {
  args: { position: "above-end" },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-44">
        <div class="tw-flex tw-justify-center">
          <button
            type="button"
            class="tw-border-none tw-bg-transparent tw-text-primary-600 tw-p-0"
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
      ${withHeaderAndFooterContent}
      `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const button = getByRole(canvasEl, "button");
    await userEvent.click(button);
  },
};
