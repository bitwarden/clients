import { CommonModule } from "@angular/common";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";

import { BadgeComponent } from "./badge.component";

export default {
  title: "Component Library/Badge",
  component: BadgeComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, BadgeComponent],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-26440&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta<BadgeComponent>;

type Story = StoryObj<BadgeComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Badge text</span>
    `,
  }),
};

export const StartIcon: Story = {
  ...Default,
  args: {
    startIcon: "bwi-check",
  },
};

// export const Primary: Story = {
//   render: (args) => ({
//     props: args,
//     template: /*html*/ `
//       <div class="tw-flex tw-flex-col tw-gap-4">
//         <div class="tw-flex tw-items-center tw-gap-2">
//           <span class="tw-text-main">span</span><span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Badge containing lengthy text</span>
//         </div>
//         <div class="tw-flex tw-items-center tw-gap-2">
//           <span class="tw-text-main">link </span><a href="#" bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Badge</a>
//         </div>
//         <div class="tw-flex tw-items-center tw-gap-2">
//           <span class="tw-text-main">button </span><button type="button" bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Badge</button>
//         </div>
//       </div>
//     `,
//   }),
// };

// export const Secondary: Story = {
//   ...Primary,
//   args: {
//     variant: "secondary",
//   },
// };

// export const Success: Story = {
//   ...Primary,
//   args: {
//     variant: "success",
//   },
// };

// export const Danger: Story = {
//   ...Primary,
//   args: {
//     variant: "danger",
//   },
// };

// export const Warning: Story = {
//   ...Primary,
//   args: {
//     variant: "warning",
//   },
// };

// export const Info: Story = {
//   ...Primary,
//   args: {
//     variant: "info",
//   },
// };

// export const Notification: Story = {
//   ...Primary,
//   args: {
//     variant: "notification",
//   },
// };

export const Truncated: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-4">
        <div>
          <span class="tw-text-main tw-block tw-mb-2">Short text (no truncation, no tooltip):</span>
          <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Short</span>
        </div>
        <div>
          <span class="tw-text-main tw-block tw-mb-2">Long text (auto-truncates with tooltip on hover):</span>
          <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>This is a very long badge text that will automatically truncate</span>
        </div>
        <div>
          <span class="tw-text-main tw-block tw-mb-2">With icon and long text:</span>
          <span bitBadge startIcon="bwi-check" ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Badge with icon and lengthy text content</span>
        </div>
      </div>
    `,
  }),
};

export const VariousLengths: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-flex tw-flex-wrap tw-gap-2">
        <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Hi</span>
        <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Medium</span>
        <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Fits perfectly</span>
        <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>This one will overflow</span>
        <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>This is definitely going to be truncated</span>
        <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Supercalifragilisticexpialidocious</span>
      </div>
      <p class="tw-text-main tw-mt-4 tw-text-sm">
        Hover over the longer badges to see the tooltip with full text. Shorter badges won't show tooltips.
      </p>
    `,
  }),
};

export const ManyBadges: Story = {
  render: (args) => ({
    props: {
      ...args,
      items: Array.from({ length: 100 }, (_, i) => i),
    },
    template: /*html*/ `
      <div class="tw-flex tw-flex-wrap tw-gap-2">
        @for (item of items; track item) {
          <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Badge {{ item }} with text that may overflow</span>
        }
      </div>
      <p class="tw-text-main tw-mt-4">
        100 badges rendered. Resize browser window to test performance.
        Open DevTools Performance tab to profile.
      </p>
    `,
  }),
};

// export const VariantsAndInteractionStates: Story = {
//   render: (args) => ({
//     props: args,
//     template: /*html*/ `
//       <span class="tw-text-main tw-mx-1">Default</span>
//       <button type="button" class="tw-mx-1" bitBadge variant="primary" [truncate]="truncate">Primary</button>
//       <button type="button" class="tw-mx-1" bitBadge variant="secondary" [truncate]="truncate">Secondary</button>
//       <button type="button" class="tw-mx-1" bitBadge variant="success" [truncate]="truncate">Success</button>
//       <button type="button" class="tw-mx-1" bitBadge variant="danger" [truncate]="truncate">Danger</button>
//       <button type="button" class="tw-mx-1" bitBadge variant="warning" [truncate]="truncate">Warning</button>
//       <button type="button" class="tw-mx-1" bitBadge variant="info" [truncate]="truncate">Info</button>
//       <button type="button" class="tw-mx-1" bitBadge variant="notification" [truncate]="truncate">Notification</button>
//       <br/><br/>
//       <span class="tw-text-main tw-mx-1">Hover</span>
//       <button type="button" class="tw-mx-1 tw-test-hover" bitBadge variant="primary" [truncate]="truncate">Primary</button>
//       <button type="button" class="tw-mx-1 tw-test-hover" bitBadge variant="secondary" [truncate]="truncate">Secondary</button>
//       <button type="button" class="tw-mx-1 tw-test-hover" bitBadge variant="success" [truncate]="truncate">Success</button>
//       <button type="button" class="tw-mx-1 tw-test-hover" bitBadge variant="danger" [truncate]="truncate">Danger</button>
//       <button type="button" class="tw-mx-1 tw-test-hover" bitBadge variant="warning" [truncate]="truncate">Warning</button>
//       <button type="button" class="tw-mx-1 tw-test-hover" bitBadge variant="info" [truncate]="truncate">Info</button>
//       <button type="button" class="tw-mx-1 tw-test-hover" bitBadge variant="notification" [truncate]="truncate">Notification</button>
//       <br/><br/>
//       <span class="tw-text-main tw-mx-1">Focus Visible</span>
//       <button type="button" class="tw-mx-1 tw-test-focus-visible" bitBadge variant="primary" [truncate]="truncate">Primary</button>
//       <button type="button" class="tw-mx-1 tw-test-focus-visible" bitBadge variant="secondary" [truncate]="truncate">Secondary</button>
//       <button type="button" class="tw-mx-1 tw-test-focus-visible" bitBadge variant="success" [truncate]="truncate">Success</button>
//       <button type="button" class="tw-mx-1 tw-test-focus-visible" bitBadge variant="danger" [truncate]="truncate">Danger</button>
//       <button type="button" class="tw-mx-1 tw-test-focus-visible" bitBadge variant="warning" [truncate]="truncate">Warning</button>
//       <button type="button" class="tw-mx-1 tw-test-focus-visible" bitBadge variant="info" [truncate]="truncate">Info</button>
//       <button type="button" class="tw-mx-1 tw-test-focus-visible" bitBadge variant="notification" [truncate]="truncate">Notification</button>
//       <br/><br/>
//       <span class="tw-text-main tw-mx-1">Disabled</span>
//       <button type="button" disabled class="tw-mx-1" bitBadge variant="primary" [truncate]="truncate">Primary</button>
//       <button type="button" disabled class="tw-mx-1" bitBadge variant="secondary" [truncate]="truncate">Secondary</button>
//       <button type="button" disabled class="tw-mx-1" bitBadge variant="success" [truncate]="truncate">Success</button>
//       <button type="button" disabled class="tw-mx-1" bitBadge variant="danger" [truncate]="truncate">Danger</button>
//       <button type="button" disabled class="tw-mx-1" bitBadge variant="warning" [truncate]="truncate">Warning</button>
//       <button type="button" disabled class="tw-mx-1" bitBadge variant="info" [truncate]="truncate">Info</button>
//       <button type="button" disabled class="tw-mx-1" bitBadge variant="notification" [truncate]="truncate">Notification</button>
//     `,
//   }),
// };
