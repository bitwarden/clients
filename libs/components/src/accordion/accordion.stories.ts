import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { BadgeComponent } from "../badge";
import { IconTileComponent } from "../icon-tile";

import { AccordionGroupComponent } from "./accordion-group.component";
import { AccordionComponent } from "./accordion.component";

export default {
  title: "Component Library/Accordion",
  component: AccordionComponent,
  decorators: [
    moduleMetadata({
      imports: [AccordionComponent, AccordionGroupComponent, IconTileComponent, BadgeComponent],
    }),
  ],
  args: {
    title: "Advanced settings",
    subtitle: "Additional configurations for custom settings",
    open: false,
    disabled: false,
    size: "default",
    variant: "default",
  },
  argTypes: {
    size: { control: "select", options: ["default", "sm"] },
    variant: { control: "select", options: ["default", "subtle"] },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/branch/rKUVGKb7Kw3d6YGoQl6Ho7/Archive---Tailwind-Component-Library?node-id=42192-6301",
    },
  },
} as Meta<AccordionComponent>;

type Story = StoryObj<AccordionComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-accordion
        ${formatArgsForCodeSnippet<AccordionComponent>(args)}
      >
        <span>
          Save time by importing data from another password manager. No data to import?
          You can manually add items to your vault.
        </span>
      </bit-accordion>
    `,
  }),
};

export const Subtle: Story = {
  ...Default,
  args: { variant: "subtle" },
};

export const WithStartIcon: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-accordion
        title="Advanced settings"
        subtitle="Additional configurations for custom settings"
        startIcon="bwi-settings"
        [(open)]="open"
      >
        <span>Content area with an icon tile in the header.</span>
      </bit-accordion>
    `,
  }),
  args: { open: false },
};

export const WithEndSlot: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-accordion
        title="Advanced settings"
        subtitle="Additional configurations for custom settings"
        [(open)]="open"
      >
        <bit-badge variant="primary" slot="end">1 of 3 complete</bit-badge>
        <span>Content area with a badge in the end slot.</span>
      </bit-accordion>
    `,
  }),
  args: { open: false },
};

export const SmallSize: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-accordion
        title="Advanced settings"
        subtitle="This subtitle is hidden in small size"
        size="sm"
        [(open)]="open"
        startIcon="bwi-settings"
      >
        <span>Small accordion content.</span>
      </bit-accordion>
    `,
  }),
  args: { open: false },
};

export const Inactive: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-accordion
        title="Inactive accordion"
        subtitle="This accordion cannot be opened"
        [disabled]="true"
      >
        <span>You cannot see this.</span>
      </bit-accordion>
    `,
  }),
};

export const DefaultExpanded: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-accordion
        title="Open by default"
        subtitle="This accordion starts expanded"
        [open]="true"
      >
        <span>This content is visible on load.</span>
      </bit-accordion>
    `,
  }),
};

export const SubtleExpanded: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-accordion
        title="Open by default"
        subtitle="This accordion starts expanded"
        [open]="true"
        variant="subtle"
      >
        <span>This content is visible on load.</span>
      </bit-accordion>
    `,
  }),
};

export const Grouped: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-accordion-group [variant]="variant">
        <bit-accordion title="First item" subtitle="Top of the group">
          <span>First accordion content.</span>
        </bit-accordion>
        <bit-accordion title="Second item" subtitle="Middle of the group">
          <span>Second accordion content.</span>
        </bit-accordion>
        <bit-accordion title="Third item" subtitle="Bottom of the group">
          <span>Third accordion content.</span>
        </bit-accordion>
      </bit-accordion-group>
    `,
  }),
};

export const SmallGrouped: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-accordion-group [variant]="variant">
        <bit-accordion title="First item" size="sm">
          <span>First accordion content.</span>
        </bit-accordion>
        <bit-accordion title="Second item" size="sm">
          <span>Second accordion content.</span>
        </bit-accordion>
        <bit-accordion title="Third item" size="sm">
          <span>Third accordion content.</span>
        </bit-accordion>
      </bit-accordion-group>
    `,
  }),
};

export const SingleSelect: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-accordion-group singleSelect [variant]="variant">
        <bit-accordion title="First item" subtitle="Only one section open at a time">
          <span>First accordion content.</span>
        </bit-accordion>
        <bit-accordion title="Second item" subtitle="Opening this closes the others">
          <span>Second accordion content.</span>
        </bit-accordion>
        <bit-accordion title="Third item" subtitle="Bottom of the group">
          <span>Third accordion content.</span>
        </bit-accordion>
      </bit-accordion-group>
    `,
  }),
};
