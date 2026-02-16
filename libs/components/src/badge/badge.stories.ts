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
    startIcon: "bwi-folder",
  },
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="tw-space-y-4">
        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Primary</h3>
          <span bitBadge variant="primary" startIcon="bwi-info-circle">Primary</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Subtle</h3>
          <span bitBadge variant="subtle" startIcon="bwi-folder">Subtle</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Success</h3>
          <span bitBadge variant="success" startIcon="bwi-check">Success</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Warning</h3>
          <span bitBadge variant="warning" startIcon="bwi-exclamation-triangle">Warning</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Danger</h3>
          <span bitBadge variant="danger" startIcon="bwi-error">Danger</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Primary</h3>
          <span bitBadge variant="accent-primary" startIcon="bwi-info-circle">Accent Primary</span>
        </div>
      </div>
    `,
  }),
};

export const Small: Story = {
  ...Default,
  args: {
    size: "small",
    startIcon: "bwi-folder",
  },
};

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
