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
      <bit-badge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Badge text</bit-badge>
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
      <bit-badge [startIcon]='startIcon'>Badge text</bit-badge>
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
          <bit-badge variant="primary">Primary</bit-badge>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Subtle</h3>
          <bit-badge variant="subtle">Subtle</bit-badge>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Success</h3>
          <bit-badge variant="success">Success</bit-badge>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Warning</h3>
          <bit-badge variant="warning">Warning</bit-badge>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Danger</h3>
          <bit-badge variant="danger">Danger</bit-badge>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Primary (Has no default icon)</h3>
          <bit-badge variant="accent-primary">Accent Primary</bit-badge>
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
          <bit-badge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>Short</bit-badge>
        </div>
        <div>
          <span class="tw-text-main tw-block tw-mb-2">Long text (auto-truncates with title on hover):</span>
          <bit-badge ${formatArgsForCodeSnippet<BadgeComponent>(args)}>This is a very long badge text that will automatically truncate</bit-badge>
        </div>
        <div>
          <span class="tw-text-main tw-block tw-mb-2">Long text (with <code>[truncate]="false"</code>):</span>
          <bit-badge [truncate]="false">This is a very long badge text that will NOT automatically truncate</bit-badge>
        </div>
      </div>
    `,
  }),
};
