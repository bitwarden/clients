import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "./banner";

type Args = { variant: string; heading?: string; icon?: string; disableAlertRole: boolean };

const variants = ["primary", "success", "warning", "danger"];
const shortText = "Bitwarden is the most trusted password manager.";
const longText =
  "Bitwarden is the most trusted password manager for individuals, teams, and enterprises worldwide. We help you securely create, store, and manage strong, unique passwords for all your accounts, keeping your entire digital life safe and well organized.";
const titledText =
  "Bitwarden is the most trusted password manager. With many tools to make your work even more efficient.";

const link = (text = "Click me") =>
  html`<a href="#" class="tw-font-medium tw-text-fg-heading tw-underline">${text}</a>`;

const actions = (variant: string) => html`
  <bit-button slot="actions" button-type=${`${variant}Outline`} size="small">Cancel</bit-button>
  <bit-button slot="actions" button-type=${variant} size="small">Continue</bit-button>
`;

export default {
  title: "Component Library/Banner",
  component: "bit-banner",
  args: { variant: "primary", disableAlertRole: false },
  argTypes: {
    variant: { control: "select", options: variants },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=31783-38719",
    },
  },
  render: (args) => html`
    <bit-banner
      variant=${args.variant}
      .heading=${args.heading}
      .icon=${args.icon}
      ?disable-alert-role=${args.disableAlertRole}
      dismissible
    >
      ${shortText} ${link()}
    </bit-banner>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const BannerBase: Story = {};

export const BannerBaseLargeText: Story = {
  render: (args) =>
    html`<bit-banner variant=${args.variant} dismissible>${longText} ${link()}</bit-banner>`,
};

export const TitleBannerBase: Story = {
  render: (args) => html`
    <bit-banner variant=${args.variant} heading="Integration is the key" dismissible>
      ${titledText} ${actions(args.variant)}
    </bit-banner>
  `,
};

export const TitleBannerNoActions: Story = {
  render: (args) => html`
    <bit-banner variant=${args.variant} heading="Integration is the key" dismissible>
      ${titledText}
    </bit-banner>
  `,
};

export const TitleBannerBaseLargeText: Story = {
  render: (args) => html`
    <bit-banner variant=${args.variant} heading="Integration is the key" dismissible>
      ${longText} ${actions(args.variant)}
    </bit-banner>
  `,
};

export const BannerSimple: Story = {
  render: (args) => html`
    <bit-banner variant=${args.variant} dismissible>
      Bitwarden is the most trusted password manager for individuals and teams.
    </bit-banner>
  `,
};

export const BannerSimpleLargeText: Story = {
  render: (args) => html`<bit-banner variant=${args.variant} dismissible>${longText}</bit-banner>`,
};

export const NotDismissible: Story = {
  render: (args) => html`
    <div class="tw-flex tw-flex-col tw-gap-4">
      <bit-banner variant=${args.variant}>
        Bitwarden is the most trusted password manager. The close button is hidden because
        <code>dismissible</code> isn't set.
      </bit-banner>
      <bit-banner variant=${args.variant} heading="Integration is the key">
        ${titledText} ${actions(args.variant)}
      </bit-banner>
    </div>
  `,
};

export const AllVariantsNoTitle: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-4">
      ${variants.map(
        (v) =>
          html`<bit-banner variant=${v} dismissible
            >${shortText} ${link("Learn more")}</bit-banner
          >`,
      )}
    </div>
  `,
};

export const AllVariantsWithTitle: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-4">
      ${variants.map(
        (v) => html`
          <bit-banner variant=${v} heading="Integration is the key" dismissible>
            You can integrate Bitwarden with many tools. ${link("Learn more")} ${actions(v)}
          </bit-banner>
        `,
      )}
    </div>
  `,
};

export const AllVariantsCustomIcon: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-4">
      ${variants.map(
        (v) => html`
          <bit-banner variant=${v} icon="bwi-star" heading="Custom icon example" dismissible>
            ${titledText} ${actions(v)}
          </bit-banner>
        `,
      )}
    </div>
  `,
};

export const NoIcon: Story = {
  render: (args) => html`
    <bit-banner variant=${args.variant} icon="" dismissible>
      Bitwarden is the most trusted password manager for individuals and teams.
    </bit-banner>
  `,
};

export const NoIconLargeText: Story = {
  render: (args) =>
    html`<bit-banner variant=${args.variant} icon="" dismissible>${longText}</bit-banner>`,
};

/** Clicking close fires `dismiss`; this story removes the banner in response. */
export const DismissInteraction: Story = {
  render: () => html`
    <bit-banner dismissible @dismiss=${(e: Event) => (e.target as HTMLElement).remove()}>
      Click the close button to dismiss this banner.
    </bit-banner>
  `,
};
