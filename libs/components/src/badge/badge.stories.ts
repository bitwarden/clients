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
  args: {
    variant: "primary",
  },
};

export const NoStartIcon: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <p>Passing <code>[startIcon]="null"</code> to badge component will prevent the icon from rendering the default icon</p>
      <span bitBadge [startIcon]='startIcon'>Badge text</span>
    `,
  }),
  args: {
    startIcon: null,
  },
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="tw-space-y-4">
        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Primary</h3>
          <span bitBadge variant="primary">Primary</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Subtle</h3>
          <span bitBadge variant="subtle">Subtle</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Success</h3>
          <span bitBadge variant="success">Success</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Warning</h3>
          <span bitBadge variant="warning">Warning</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Danger</h3>
          <span bitBadge variant="danger">Danger</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Primary</h3>
          <span bitBadge variant="accent-primary">Accent Primary</span>
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
          <span class="tw-text-main tw-block tw-mb-2">Long text (auto-truncates with title on hover):</span>
          <span bitBadge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>This is a very long badge text that will automatically truncate</span>
        </div>
      </div>
    `,
  }),
};
