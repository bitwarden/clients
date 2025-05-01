import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { SharedModule } from "../shared/shared.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { PopoverTriggerForDirective } from "./popover-trigger-for.directive";
import { PopoverModule } from "./popover.module";

export default {
  title: "Component Library/Popover",
  decorators: [
    moduleMetadata({
      imports: [PopoverModule, ButtonModule, IconButtonModule, SharedModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
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

const popoverContent = `
  <bit-popover [title]="'Example Title'" #myPopover>
    <div>Lorem ipsum dolor <a href="#">adipisicing elit</a>.</div>
    <ul class="tw-mt-2 tw-mb-0 tw-pl-4">
      <li>Dolor sit amet consectetur</li>
      <li>Esse labore veniam tempora</li>
      <li>Adipisicing elit ipsum <a href="#">iustolaborum</a></li>
    </ul>
    <button bitButton class="tw-mt-3" (click)="triggerRef.closePopover()">Close</button>
  </bit-popover>
`;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const Open: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-popover [title]="'Example Title'" #myPopover="popoverComponent">
        <div>Lorem ipsum dolor <a href="#">adipisicing elit</a>.</div>
        <ul class="tw-mt-2 tw-mb-0 tw-pl-4">
          <li>Dolor sit amet consectetur</li>
          <li>Esse labore veniam tempora</li>
          <li>Adipisicing elit ipsum <a href="#">iustolaborum</a></li>
        </ul>
      </bit-popover>

      <div class="tw-h-40">
        <div class="cdk-overlay-pane bit-popover-right bit-popover-right-start">
          <ng-container *ngTemplateOutlet="myPopover.templateRef"></ng-container>
        </div>
      </div>
      `,
  }),
};

export const OpenLongTitle: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-popover [title]="'Example Title that is really long it wraps 2 lines'" #myPopover="popoverComponent">
        <div>Lorem ipsum dolor <a href="#">adipisicing elit</a>.</div>
        <ul class="tw-mt-2 tw-mb-0 tw-pl-4">
          <li>Dolor sit amet consectetur</li>
          <li>Esse labore veniam tempora</li>
          <li>Adipisicing elit ipsum <a href="#">iustolaborum</a></li>
        </ul>
      </bit-popover>

      <div class="tw-h-40">
        <div class="cdk-overlay-pane bit-popover-right bit-popover-right-start">
          <ng-container *ngTemplateOutlet="myPopover.templateRef"></ng-container>
        </div>
      </div>
      `,
  }),
};

export const InitiallyOpen: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          [popoverOpen]="true"
          #triggerRef="popoverTrigger"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const RightStart: Story = {
  args: {
    position: "right-start",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const RightCenter: Story = {
  args: {
    position: "right-center",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const RightEnd: Story = {
  args: {
    position: "right-end",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const LeftStart: Story = {
  args: {
    position: "left-start",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56 tw-flex tw-justify-end">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const LeftCenter: Story = {
  args: {
    position: "left-center",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56 tw-flex tw-justify-end">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};
export const LeftEnd: Story = {
  args: {
    position: "left-end",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56 tw-flex tw-justify-end">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const BelowStart: Story = {
  args: {
    position: "below-start",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56 tw-flex tw-justify-center">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const BelowCenter: Story = {
  args: {
    position: "below-center",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56 tw-flex tw-justify-center">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const BelowEnd: Story = {
  args: {
    position: "below-end",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56 tw-flex tw-justify-center">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const AboveStart: Story = {
  args: {
    position: "above-start",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56 tw-flex tw-justify-center">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const AboveCenter: Story = {
  args: {
    position: "above-center",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56 tw-flex tw-justify-center">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};

export const AboveEnd: Story = {
  args: {
    position: "above-end",
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-mt-56 tw-flex tw-justify-center">
        <button
          type="button"
          class="tw-border-none tw-bg-transparent tw-text-primary-600"
          [bitPopoverTriggerFor]="myPopover"
          #triggerRef="popoverTrigger"
          [position]="'${args.position}'"
        >
          <i class="bwi bwi-question-circle"></i>
        </button>
      </div>
      ${popoverContent}
      `,
  }),
};
