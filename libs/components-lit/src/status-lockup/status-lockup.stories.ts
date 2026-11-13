import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import {
  ActiveSendIcon,
  type BitSvg,
  DeactivatedOrg,
  DevicesIcon,
  DomainIcon,
  EmptyTrash,
  GearIcon,
  NoCredentialsIcon,
  NoFolders,
  NoResults,
  NoSendsIcon,
  RestrictedView,
  Security,
  VaultOpen,
} from "@bitwarden/assets/svg";

import "../button/button";
import "../icon-tile/icon-tile";
import { BitwardenIcon } from "../icon/shared-icon";
import "../svg/svg";

import "./status-lockup";

type Args = { size: string; svg: string; icon: BitwardenIcon };

const Svgs: Record<string, BitSvg> = {
  EmptyTrash,
  NoFolders,
  NoResults,
  NoSendsIcon,
  VaultOpen,
  DeactivatedOrg,
  ActiveSendIcon,
  DevicesIcon,
  Security,
  NoCredentialsIcon,
  RestrictedView,
  DomainIcon,
  GearIcon,
};

const graphic = (name: string) => html`<bit-svg slot="graphic" .content=${Svgs[name]}></bit-svg>`;

const description = html`<span slot="description">
  Your description here. It could be a bit of a longer description, but ideally not too long for
  this type of component. Enough to give some context!
</span>`;

const button = html`<bit-button slot="button" button-type="secondary" start-icon="bwi-plus"
  >New item</bit-button
>`;

const svgControl = { svg: { options: Object.keys(Svgs), control: { type: "select" as const } } };

export default {
  title: "Component Library/Status Lockup",
  component: "bit-status-lockup",
  args: { size: "base", svg: "NoResults", icon: "bwi-wrench" },
  argTypes: { ...svgControl, size: { control: "radio", options: ["base", "small"] } },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21665-25102&t=k6OTDDPZOTtypRqo-11",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {
  render: (args) => html`
    <bit-status-lockup class="tw-text-main" size=${args.size}>
      ${graphic(args.svg)}
      <span slot="title">No items found</span>
      ${description} ${button}
    </bit-status-lockup>
  `,
};

export const Small: Story = { ...Default, args: { size: "small" } };

/** Drag the bottom-right corner to resize; the lockup switches to `small` below 768px. */
export const Responsive: Story = {
  render: (args) => html`
    <div
      class="tw-border tw-border-solid tw-border-secondary-300 tw-resize-x tw-overflow-auto"
      style="width: 24rem; max-width: 100%;"
    >
      <bit-status-lockup class="tw-text-main">
        ${graphic(args.svg)}
        <span slot="title">No items found</span>
        ${description} ${button}
      </bit-status-lockup>
    </div>
  `,
};

export const WithIconTile: Story = {
  render: (args) => html`
    <bit-status-lockup class="tw-text-main">
      <bit-icon-tile slot="graphic" icon=${args.icon}></bit-icon-tile>
      <span slot="title">No items found</span>
      ${description} ${button}
    </bit-status-lockup>
  `,
  argTypes: { icon: { control: "text" } },
};

export const NoGraphic: Story = {
  render: () => html`
    <bit-status-lockup class="tw-text-main">
      <span slot="title">No items found</span>
      ${description} ${button}
    </bit-status-lockup>
  `,
};

export const NoButton: Story = {
  render: (args) => html`
    <bit-status-lockup class="tw-text-main">
      ${graphic(args.svg)}
      <span slot="title">No items found</span>
      ${description}
    </bit-status-lockup>
  `,
};

/** An unbroken search term has no break opportunity, so it must wrap mid-word to stay in bounds. */
export const LongUnbrokenTitle: Story = {
  render: (args) => html`
    <div class="tw-border tw-border-solid tw-border-secondary-300" style="width: 380px;">
      <bit-status-lockup class="tw-text-main">
        ${graphic(args.svg)}
        <span slot="title">No items match "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWO"</span>
        ${button}
      </bit-status-lockup>
    </div>
  `,
};
