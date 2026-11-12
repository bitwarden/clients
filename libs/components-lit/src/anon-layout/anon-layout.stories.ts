import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import { BitSvg, LockIcon } from "@bitwarden/assets/svg";

import type { LandingContentMaxWidthType } from "../landing-layout/landing-content";
import "./anon-layout";
import "../avatar/avatar";
import "../button/button";

type Args = {
  pageTitle?: string;
  pageSubtitle?: string;
  icon: BitSvg | null;
  showReadonlyHostname: boolean;
  maxWidth: LandingContentMaxWidthType;
  hideCardWrapper: boolean;
  hideLogo: boolean;
  hideFooter: boolean;
  hideBackgroundIllustration: boolean;
  contentLength: "normal" | "long" | "thin";
  showSecondary: boolean;
  includeHeaderActions: boolean;
};

const lorem =
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.";

const content = (length: Args["contentLength"]) => {
  switch (length) {
    case "thin":
      return html`<div class="tw-text-center"><div class="tw-font-medium">Thin Content</div></div>`;
    case "long":
      return html`<div>
        <div class="tw-font-medium">Long Content</div>
        <div>${lorem}</div>
        <div>${lorem}</div>
      </div>`;
    default:
      return html`<div>
        <div class="tw-font-medium">Normal Content</div>
        <div>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </div>
      </div>`;
  }
};

export default {
  title: "Component Library/Anon Layout",
  component: "bit-anon-layout",
  render: (args) =>
    html`<bit-anon-layout
      page-title=${args.pageTitle ?? nothing}
      page-subtitle=${args.pageSubtitle ?? nothing}
      .icon=${args.icon}
      ?show-readonly-hostname=${args.showReadonlyHostname}
      hostname="bitwarden.com"
      version="Version 2024.1.1"
      max-width=${args.maxWidth}
      ?hide-card-wrapper=${args.hideCardWrapper}
      ?hide-logo=${args.hideLogo}
      ?hide-footer=${args.hideFooter}
      ?hide-background-illustration=${args.hideBackgroundIllustration}
    >
      ${
        args.includeHeaderActions
          ? html`<div slot="header-actions" class="tw-flex tw-items-center tw-gap-2">
              <bit-avatar text="Bob Loblaw"></bit-avatar>
            </div>`
          : nothing
      }
      ${content(args.contentLength)}
      ${
        args.showSecondary
          ? html`<div slot="secondary" class="tw-text-center">
              <div class="tw-font-medium tw-mb-2">Secondary Projected Content (optional)</div>
              <bit-button>Perform Action</bit-button>
            </div>`
          : nothing
      }
    </bit-anon-layout>`,
  argTypes: {
    pageTitle: { control: "text" },
    pageSubtitle: { control: "text" },
    icon: { control: false, table: { disable: true } },
    maxWidth: { control: "select", options: ["md", "lg", "xl", "2xl", "3xl"] },
    contentLength: { control: "radio", options: ["normal", "long", "thin"] },
  },
  args: {
    pageTitle: "The Page Title",
    pageSubtitle: "The subtitle (optional)",
    icon: LockIcon,
    showReadonlyHostname: false,
    maxWidth: "md",
    hideCardWrapper: false,
    hideLogo: false,
    hideFooter: false,
    hideBackgroundIllustration: false,
    contentLength: "normal",
    showSecondary: false,
    includeHeaderActions: false,
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

const longTitle =
  "This is a very long title that might not fit in the default width. It's really long and descriptive, so it might take up more space than usual.";
const longSubtitle =
  "This is a very long subtitle that might not fit in the default width. It's really long and descriptive, so it might take up more space than usual.";

export const NormalPrimaryContent: Story = { args: { contentLength: "normal" } };

export const LongPrimaryContent: Story = { args: { contentLength: "long" } };

export const ThinPrimaryContent: Story = { args: { contentLength: "thin" } };

export const LongContentAndTitlesAndDefaultWidth: Story = {
  args: { pageTitle: longTitle, pageSubtitle: longSubtitle, contentLength: "long" },
};

export const LongContentAndTitlesAndLargestWidth: Story = {
  args: {
    pageTitle: longTitle,
    pageSubtitle: longSubtitle,
    contentLength: "long",
    maxWidth: "3xl",
  },
};

export const SecondaryContent: Story = { args: { showSecondary: true } };

export const WithHeaderActions: Story = { args: { includeHeaderActions: true } };

export const NoTitle: Story = { args: { pageTitle: undefined } };

export const NoSubtitle: Story = { args: { pageSubtitle: undefined } };

export const NoWrapper: Story = { args: { hideCardWrapper: true } };

export const NoIcon: Story = { args: { icon: null } };

export const NoLogo: Story = { args: { hideLogo: true } };

export const NoFooter: Story = { args: { hideFooter: true } };

export const NoBackgroundIllustration: Story = { args: { hideBackgroundIllustration: true } };

export const ReadonlyHostname: Story = { args: { showReadonlyHostname: true } };

export const MinimalState: Story = {
  args: {
    pageTitle: undefined,
    pageSubtitle: undefined,
    contentLength: "normal",
    hideCardWrapper: true,
    icon: null,
    hideLogo: true,
    hideFooter: true,
    hideBackgroundIllustration: true,
  },
};
