import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

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
    heading: "Advanced settings",
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
        [heading]="heading"
        [subtitle]="subtitle"
        [(open)]="open"
        [disabled]="disabled"
        [size]="size"
        [variant]="variant"
      >
        <p class="tw-m-0">
          Save time by importing data from another password manager. No data to import?
          You can manually add items to your vault.
        </p>
      </bit-accordion>
    `,
  }),
};

export const Subtle: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-accordion
        [heading]="heading"
        [subtitle]="subtitle"
        [(open)]="open"
        [disabled]="disabled"
        [size]="size"
        variant="subtle"
      >
        <p class="tw-m-0">
          Save time by importing data from another password manager. No data to import?
          You can manually add items to your vault.
        </p>
      </bit-accordion>
    `,
  }),
};

export const WithStartIcon: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-accordion
        heading="Advanced settings"
        subtitle="Additional configurations for custom settings"
        startIcon="bwi-settings"
        [(open)]="open"
      >
        <p class="tw-m-0">Content area with an icon tile in the header.</p>
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
        heading="Advanced settings"
        subtitle="Additional configurations for custom settings"
        [(open)]="open"
      >
        <bit-badge variant="primary" end>1 of 3 complete</bit-badge>
        <p class="tw-m-0">Content area with a badge in the end slot.</p>
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
        heading="Advanced settings"
        subtitle="This subtitle is hidden in small size"
        size="sm"
        [(open)]="open"
        startIcon="bwi-settings"
      >
        <p class="tw-m-0">Small accordion content.</p>
      </bit-accordion>
    `,
  }),
  args: { open: false },
};

export const Inactive: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-accordion
        heading="Inactive accordion"
        subtitle="This accordion cannot be opened"
        [disabled]="true"
      >
        <p class="tw-m-0">You cannot see this.</p>
      </bit-accordion>
    `,
  }),
};

export const DefaultExpanded: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-accordion
        heading="Open by default"
        subtitle="This accordion starts expanded"
        [open]="true"
      >
        <p class="tw-m-0">This content is visible on load.</p>
      </bit-accordion>
    `,
  }),
};

export const SubtleExpanded: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-accordion
        heading="Open by default"
        subtitle="This accordion starts expanded"
        [open]="true"
        variant="subtle"
      >
        <p class="tw-m-0">This content is visible on load.</p>
      </bit-accordion>
    `,
  }),
};

export const Grouped: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-accordion-group [variant]="variant">
        <bit-accordion heading="First item" subtitle="Top of the group">
          <p class="tw-m-0">First accordion content.</p>
        </bit-accordion>
        <bit-accordion heading="Second item" subtitle="Middle of the group">
          <p class="tw-m-0">Second accordion content.</p>
        </bit-accordion>
        <bit-accordion heading="Third item" subtitle="Bottom of the group">
          <p class="tw-m-0">Third accordion content.</p>
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
        <bit-accordion heading="First item" size="sm">
          <p class="tw-m-0">First accordion content.</p>
        </bit-accordion>
        <bit-accordion heading="Second item" size="sm">
          <p class="tw-m-0">Second accordion content.</p>
        </bit-accordion>
        <bit-accordion heading="Third item" size="sm">
          <p class="tw-m-0">Third accordion content.</p>
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
        <bit-accordion heading="First item" subtitle="Only one section open at a time">
          <p class="tw-m-0">First accordion content.</p>
        </bit-accordion>
        <bit-accordion heading="Second item" subtitle="Opening this closes the others">
          <p class="tw-m-0">Second accordion content.</p>
        </bit-accordion>
        <bit-accordion heading="Third item" subtitle="Bottom of the group">
          <p class="tw-m-0">Third accordion content.</p>
        </bit-accordion>
      </bit-accordion-group>
    `,
  }),
};
