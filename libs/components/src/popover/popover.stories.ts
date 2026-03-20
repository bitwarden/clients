import { signal } from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { getByRole, userEvent } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { I18nMockService } from "../utils/i18n-mock.service";

import { PopoverAnchorForDirective } from "./popover-anchor-for.directive";
import { PopoverModule } from "./popover.module";

export default {
  title: "Component Library/Popover",
  decorators: [
    moduleMetadata({
      imports: [PopoverModule, ButtonModule, IconButtonModule, LinkModule],
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
          <i class="bwi bwi-help"></i>
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
          <i class="bwi bwi-help"></i>
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
          <i class="bwi bwi-help"></i>
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
          <i class="bwi bwi-help"></i>
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
          <i class="bwi bwi-help"></i>
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
            <i class="bwi bwi-help"></i>
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
            <i class="bwi bwi-help"></i>
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
            <i class="bwi bwi-help"></i>
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
            <i class="bwi bwi-help"></i>
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
            <i class="bwi bwi-help"></i>
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
            <i class="bwi bwi-help"></i>
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
            <i class="bwi bwi-help"></i>
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
            <i class="bwi bwi-help"></i>
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
            <i class="bwi bwi-help"></i>
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

export const SpotlightTour: Story = {
  render: () => ({
    props: {
      tourStep: signal<0 | 1 | 2 | 3>(0),
      startTour() {
        this.tourStep.set(1);
      },
      nextTourStep() {
        this.tourStep.update((prev: 0 | 1 | 2 | 3) => (prev < 3 ? ((prev + 1) as 3) : 0));
      },
      skipTour() {
        this.tourStep.set(0);
      },
    },
    template: /*html*/ `
      <div class="tw-h-[600px] tw-mt-32">
        <div class="tw-mb-6">
          <button
            type="button"
            bitButton
            buttonType="primary"
            (click)="startTour()"
          >
            Start Tour
          </button>
        </div>

        <div class="tw-grid tw-grid-cols-3 tw-gap-4">
          <!-- Step 1: Create Button -->
          <div
            class="tw-p-6 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-bg-background tw-text-center"
            [bitPopoverAnchorFor]="step1Popover"
            [popoverOpen]="tourStep() === 1"
            [spotlight]="true"
            [position]="'below-center'"
            #step1Ref="popoverAnchor"
          >
            <i class="bwi bwi-add-circle tw-text-4xl tw-text-primary-600 tw-mb-3"></i>
            <h3 class="tw-text-base tw-font-semibold tw-mb-2">Create</h3>
            <p class="tw-text-sm tw-text-muted tw-mb-0">Add new items</p>
          </div>

          <!-- Step 2: Search Button -->
          <div
            class="tw-p-6 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-bg-background tw-text-center"
            [bitPopoverAnchorFor]="step2Popover"
            [popoverOpen]="tourStep() === 2"
            [spotlight]="true"
            [position]="'below-center'"
            #step2Ref="popoverAnchor"
          >
            <i class="bwi bwi-search tw-text-4xl tw-text-primary-600 tw-mb-3"></i>
            <h3 class="tw-text-base tw-font-semibold tw-mb-2">Search</h3>
            <p class="tw-text-sm tw-text-muted tw-mb-0">Find anything</p>
          </div>

          <!-- Step 3: Settings Button -->
          <div
            class="tw-p-6 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-bg-background tw-text-center"
            [bitPopoverAnchorFor]="step3Popover"
            [popoverOpen]="tourStep() === 3"
            [spotlight]="true"
            [position]="'below-center'"
            #step3Ref="popoverAnchor"
          >
            <i class="bwi bwi-settings tw-text-4xl tw-text-primary-600 tw-mb-3"></i>
            <h3 class="tw-text-base tw-font-semibold tw-mb-2">Settings</h3>
            <p class="tw-text-sm tw-text-muted tw-mb-0">Configure options</p>
          </div>
        </div>
      </div>

      <!-- Tour Step 1 -->
      <bit-popover [title]="'Step 1: Create Items'" (closed)="skipTour()" #step1Popover>
        <div>Click the <strong>Create</strong> button to add new items to your vault.</div>
        <p class="tw-mt-2 tw-mb-0">This is the primary action for adding passwords, notes, and other secure items.</p>
        <div class="tw-flex tw-gap-2 tw-mt-4">
          <button type="button" bitButton buttonType="primary" (click)="nextTourStep()">Next</button>
          <button type="button" bitButton buttonType="secondary" (click)="skipTour()">Skip Tour</button>
        </div>
      </bit-popover>

      <!-- Tour Step 2 -->
      <bit-popover [title]="'Step 2: Search'" (closed)="skipTour()" #step2Popover>
        <div>Use the <strong>Search</strong> feature to quickly find any item in your vault.</div>
        <p class="tw-mt-2 tw-mb-0">Search works across all your items, folders, and collections.</p>
        <div class="tw-flex tw-gap-2 tw-mt-4">
          <button type="button" bitButton buttonType="primary" (click)="nextTourStep()">Next</button>
          <button type="button" bitButton buttonType="secondary" (click)="skipTour()">Skip Tour</button>
        </div>
      </bit-popover>

      <!-- Tour Step 3 -->
      <bit-popover [title]="'Step 3: Settings'" (closed)="skipTour()" #step3Popover>
        <div>Access <strong>Settings</strong> to customize your experience and manage your account.</div>
        <p class="tw-mt-2 tw-mb-0">You can update preferences, security options, and more.</p>
        <div class="tw-flex tw-gap-2 tw-mt-4">
          <button type="button" bitButton buttonType="primary" (click)="nextTourStep()">Finish Tour</button>
          <button type="button" bitButton buttonType="secondary" (click)="skipTour()">Skip Tour</button>
        </div>
      </bit-popover>
      `,
  }),
};

export const MultipleSpotlights: Story = {
  render: () => ({
    props: {
      popover1Open: false,
      popover2Open: false,
      openBoth() {
        this.popover1Open = true;
        this.popover2Open = true;
      },
      closeBoth() {
        this.popover1Open = false;
        this.popover2Open = false;
      },
    },
    template: /*html*/ `
      <div class="tw-h-[600px] tw-mt-32">
        <div class="tw-mb-6 tw-flex tw-gap-2">
          <button
            type="button"
            bitButton
            buttonType="primary"
            (click)="openBoth()"
          >
            Open Both
          </button>
          <button
            type="button"
            bitButton
            buttonType="secondary"
            (click)="closeBoth()"
          >
            Close Both
          </button>
        </div>

        <div class="tw-grid tw-grid-cols-2 tw-gap-8">
          <!-- Popover 1 -->
          <div
            class="tw-p-8 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-bg-background tw-text-center"
            [bitPopoverAnchorFor]="popover1"
            [(popoverOpen)]="popover1Open"
            [spotlight]="true"
            [spotlightPadding]="12"
            [position]="'below-center'"
          >
            <i class="bwi bwi-star tw-text-4xl tw-text-primary-600 tw-mb-3"></i>
            <h3 class="tw-text-base tw-font-semibold tw-mb-2">Feature 1</h3>
            <p class="tw-text-sm tw-text-muted tw-mb-0">First feature card</p>
          </div>

          <!-- Popover 2 -->
          <div
            class="tw-p-8 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-bg-background tw-text-center"
            [bitPopoverAnchorFor]="popover2"
            [(popoverOpen)]="popover2Open"
            [spotlight]="true"
            [spotlightPadding]="12"
            [position]="'below-center'"
          >
            <i class="bwi bwi-heart tw-text-4xl tw-text-primary-600 tw-mb-3"></i>
            <h3 class="tw-text-base tw-font-semibold tw-mb-2">Feature 2</h3>
            <p class="tw-text-sm tw-text-muted tw-mb-0">Second feature card</p>
          </div>
        </div>
      </div>

      <!-- Popover 1 Content -->
      <bit-popover [title]="'Feature 1'" #popover1>
        <div>This is the first popover with spotlight.</div>
        <p class="tw-mt-2 tw-mb-0">All spotlight popovers are automatically grouped, so only one can be open at a time.</p>
        <div class="tw-flex tw-gap-2 tw-mt-4">
          <button type="button" bitButton buttonType="secondary" (click)="popover1Open = false">Close</button>
        </div>
      </bit-popover>

      <!-- Popover 2 Content -->
      <bit-popover [title]="'Feature 2'" #popover2>
        <div>This is the second popover with spotlight.</div>
        <p class="tw-mt-2 tw-mb-0">When you opened both, Feature 1 automatically closed because spotlight popovers are grouped.</p>
        <div class="tw-flex tw-gap-2 tw-mt-4">
          <button type="button" bitButton buttonType="secondary" (click)="popover2Open = false">Close</button>
        </div>
      </bit-popover>
      `,
  }),
};
