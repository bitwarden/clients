import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import { RegistrationCheckEmailIcon } from "@bitwarden/assets/svg";

import type { LandingLayoutClientType } from "./landing-layout";
import "./landing-card";
import "./landing-content";
import "./landing-footer";
import "./landing-header";
import "./landing-hero";
import "./landing-layout";
import "../button/button";

type Args = {
  hideBackgroundIllustration: boolean;
  clientType: LandingLayoutClientType;
  contentLength: "normal" | "long" | "thin";
  includeHeader: boolean;
  includeFooter: boolean;
};

const lorem =
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?";

const content = (length: Args["contentLength"]) => {
  switch (length) {
    case "thin":
      return html`<div class="tw-text-center tw-p-8">
        <div class="tw-font-medium">Thin Content</div>
      </div>`;
    case "long":
      return html`<div class="tw-p-8">
        <div class="tw-font-medium tw-mb-4">Long Content</div>
        <div class="tw-mb-4">${lorem}</div>
        <div class="tw-mb-4">${lorem}</div>
      </div>`;
    default:
      return html`<div class="tw-p-8">
        <div class="tw-font-medium tw-mb-4">Normal Content</div>
        <div>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </div>
      </div>`;
  }
};

export default {
  title: "Component Library/Landing Layout",
  component: "bit-landing-layout",
  render: (args) => html`
    <bit-landing-layout
      ?hide-background-illustration=${args.hideBackgroundIllustration}
      client-type=${args.clientType}
    >
      ${
        args.includeHeader
          ? html`<bit-landing-header>
              <div class="tw-p-4">
                <div class="tw-flex tw-items-center tw-gap-4">
                  <div class="tw-text-xl tw-font-semibold">Header Content</div>
                </div>
              </div>
            </bit-landing-header>`
          : nothing
      }
      <div>${content(args.contentLength)}</div>
      ${
        args.includeFooter
          ? html`<bit-landing-footer>
              <div class="tw-text-center tw-text-sm tw-text-muted">
                <div>Footer Content</div>
              </div>
            </bit-landing-footer>`
          : nothing
      }
    </bit-landing-layout>
  `,
  argTypes: {
    hideBackgroundIllustration: { control: "boolean" },
    clientType: { control: "radio", options: ["web", "browser", "desktop"] },
    contentLength: { control: "radio", options: ["normal", "long", "thin"] },
    includeHeader: { control: "boolean" },
    includeFooter: { control: "boolean" },
  },
  args: {
    hideBackgroundIllustration: false,
    clientType: "web",
    contentLength: "normal",
    includeHeader: false,
    includeFooter: false,
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = { args: { contentLength: "normal" } };

export const WithHeader: Story = { args: { includeHeader: true } };

export const WithFooter: Story = { args: { includeFooter: true } };

export const WithHeaderAndFooter: Story = { args: { includeHeader: true, includeFooter: true } };

export const LongContent: Story = {
  args: { contentLength: "long", includeHeader: true, includeFooter: true },
};

export const ThinContent: Story = {
  args: { contentLength: "thin", includeHeader: true, includeFooter: true },
};

export const NoBackgroundIllustration: Story = {
  args: { hideBackgroundIllustration: true, includeHeader: true, includeFooter: true },
};

export const MinimalState: Story = {
  args: {
    contentLength: "thin",
    hideBackgroundIllustration: true,
    includeHeader: false,
    includeFooter: false,
  },
};

/**
 * All landing primitives together. Children are deliberately out of order: the header, footer and
 * hero are placed by tag name.
 */
export const FullPage: Story = {
  render: (args) => html`
    <bit-landing-layout
      ?hide-background-illustration=${args.hideBackgroundIllustration}
      client-type=${args.clientType}
    >
      <bit-landing-footer footer-vertical-padding="compact">
        <span class="tw-text-sm tw-text-muted">© Bitwarden Inc.</span>
      </bit-landing-footer>
      <bit-landing-header>
        <bit-button button-type="secondary">Log in</bit-button>
      </bit-landing-header>
      <bit-landing-content max-width="md">
        <bit-landing-card>
          <p class="tw-m-0">Your form or content here.</p>
        </bit-landing-card>
        <bit-landing-hero
          .icon=${RegistrationCheckEmailIcon}
          title="Check your email"
          subtitle="Follow the link in the email to continue."
        ></bit-landing-hero>
      </bit-landing-content>
    </bit-landing-layout>
  `,
};
