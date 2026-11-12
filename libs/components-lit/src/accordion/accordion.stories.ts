import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./accordion";
import "./accordion-group";

type Args = {
  heading: string;
  subtitle: string;
  open: boolean;
  disabled: boolean;
  size: string;
  variant: string;
  height: string;
};

const overflowContent = html`
  <p>
    Series merger iterate round conversion deploy pivot SDK exit merger blockchain learning pivot
    investor. Merger series SDK growth launch round growth pivot. Round KPI marketplace cloud SDK
    unicorn iterate merger iterate funding investor optimize ecosystem strategy churn.
  </p>
  <p>
    Optimize startup acquisition blockchain metrics growth ROI bootstrap deploy acquisition. Iterate
    disrupt revenue exit revenue exit hacking exit disrupt streamline lean investor growth. Unicorn
    optimize innovate cloud MVP investor revenue round pivot innovate synergy. ROI deploy framework
    equity SDK API KPI unicorn. Launch acquisition ecosystem blockchain streamline unicorn
    streamline launch optimize iterate machine AI. Valuation capital equity hacking KPI prototype
    SDK. SDK API startup machine leverage strategy AI cloud capital automate revenue integrate SaaS
    strategy.
  </p>
  <p>
    Acquisition agile merger framework funding learning. KPI launch valuation integrate AI automate
    valuation. Acquisition valuation angel strategy innovate integrate churn growth API cloud AI
    equity.
  </p>
  <p>
    Exit MVP innovate bootstrap funding stack disrupt SaaS stack. Disrupt hacking conversion
    streamline launch conversion valuation. Angel MVP funding conversion growth synergy churn SDK
    cloud capital deploy churn angel blockchain. Unicorn cloud revenue revenue ecosystem AI angel
    churn. Strategy revenue venture exit prototype innovate series startup angel lean AI synergy
    scale hacking.
  </p>
`;

export default {
  title: "Component Library/Accordion",
  component: "bit-accordion",
  args: {
    heading: "Advanced settings",
    subtitle: "Additional configurations for custom settings",
    open: false,
    disabled: false,
    size: "default",
    variant: "default",
    height: "constrained",
  },
  argTypes: {
    size: { control: "select", options: ["default", "sm"] },
    variant: { control: "select", options: ["default", "subtle"] },
    height: { control: "select", options: ["constrained", "auto"] },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/branch/rKUVGKb7Kw3d6YGoQl6Ho7/Archive---Tailwind-Component-Library?node-id=42192-6301",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {
  render: (args) => html`
    <bit-accordion
      heading=${args.heading}
      subtitle=${args.subtitle}
      ?open=${args.open}
      ?disabled=${args.disabled}
      size=${args.size}
      variant=${args.variant}
      height=${args.height}
    >
      <span>
        Save time by importing data from another password manager. No data to import? You can
        manually add items to your vault.
      </span>
    </bit-accordion>
  `,
};

export const Subtle: Story = { ...Default, args: { variant: "subtle" } };

export const WithStartIcon: Story = {
  render: (args) => html`
    <bit-accordion
      heading="Advanced settings"
      subtitle="Additional configurations for custom settings"
      start-icon="bwi-cog"
      ?open=${args.open}
    >
      <span>Content area with an icon tile in the header.</span>
    </bit-accordion>
  `,
};

export const WithEndSlot: Story = {
  render: (args) => html`
    <bit-accordion
      heading="Advanced settings"
      subtitle="Additional configurations for custom settings"
      ?open=${args.open}
    >
      <span
        slot="end"
        class="tw-rounded-full tw-border tw-border-solid tw-border-border-brand-soft tw-bg-bg-brand-softer tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium tw-text-fg-brand-strong"
        >1 of 3 complete</span
      >
      <span>Content area with a badge in the end slot.</span>
    </bit-accordion>
  `,
};

export const SmallSize: Story = {
  render: (args) => html`
    <bit-accordion
      heading="Advanced settings"
      subtitle="This subtitle is hidden in small size"
      size="sm"
      start-icon="bwi-cog"
      ?open=${args.open}
    >
      <span>Small accordion content.</span>
    </bit-accordion>
  `,
};

export const Inactive: Story = {
  render: () => html`
    <bit-accordion heading="Inactive accordion" subtitle="This accordion cannot be opened" disabled>
      <span>You cannot see this.</span>
    </bit-accordion>
  `,
};

export const DefaultExpanded: Story = {
  render: () => html`
    <bit-accordion heading="Open by default" subtitle="This accordion starts expanded" open>
      <span>This content is visible on load.</span>
    </bit-accordion>
  `,
};

export const Overflow: Story = {
  render: () => html`
    <bit-accordion
      heading="This content overflows the panel"
      subtitle="Bunch of stuff in here. Watch it scroll"
      open
    >
      ${overflowContent}
    </bit-accordion>
  `,
};

export const AutoHeight: Story = {
  render: () => html`
    <bit-accordion
      heading="This content does not overflow the panel"
      subtitle="Auto height sizes the panel to its content instead of scrolling it"
      open
      height="auto"
    >
      ${overflowContent}
    </bit-accordion>
  `,
};

export const SubtleExpanded: Story = {
  render: () => html`
    <bit-accordion
      heading="Open by default"
      subtitle="This accordion starts expanded"
      open
      variant="subtle"
    >
      <span>This content is visible on load.</span>
    </bit-accordion>
  `,
};

const groupItems = (size: string, subtitles: string[]) =>
  ["First", "Second", "Third"].map(
    (name, i) => html`
      <bit-accordion
        heading="${name} item"
        subtitle=${size === "sm" ? "" : subtitles[i]}
        size=${size}
      >
        <span>${name} accordion content.</span>
      </bit-accordion>
    `,
  );

export const Grouped: Story = {
  render: (args) => html`
    <bit-accordion-group variant=${args.variant}>
      ${groupItems("default", ["Top of the group", "Middle of the group", "Bottom of the group"])}
    </bit-accordion-group>
  `,
};

export const SmallGrouped: Story = {
  render: (args) => html`
    <bit-accordion-group variant=${args.variant}>${groupItems("sm", [])}</bit-accordion-group>
  `,
};

export const SingleSelect: Story = {
  render: (args) => html`
    <bit-accordion-group single-select variant=${args.variant}>
      ${groupItems("default", [
        "Only one section open at a time",
        "Opening this closes the others",
        "Bottom of the group",
      ])}
    </bit-accordion-group>
  `,
};
