import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing, TemplateResult } from "lit";

import "./header";
import "../breadcrumbs/breadcrumbs";
import "../breadcrumbs/breadcrumb";
import "../avatar/avatar";
import "../button/button";
import "../icon/icon";
import "../icon-button/icon-button";
import "../icon-tile/icon-tile";
import "../input/input";
import "../tabs/tab-nav-bar/tab-nav-bar";
import "../tabs/tab-nav-bar/tab-link";

/** `active` marks the last crumb `current` (its route matches the URL), promoting it to the `<h1>`. */
const breadcrumbs = (crumbs: string[], active = false) =>
  html`<bit-breadcrumbs slot="breadcrumbs">
    ${crumbs.map((crumb, i) =>
      active && i === crumbs.length - 1
        ? html`<bit-breadcrumb current>${crumb}</bit-breadcrumb>`
        : html`<bit-breadcrumb href=${active ? "#" : nothing}>${crumb}</bit-breadcrumb>`,
    )}
  </bit-breadcrumbs>`;

const tabs = html`<bit-tab-nav-bar slot="tabs">
  <bit-tab-link href="#" active>Foo</bit-tab-link>
  <bit-tab-link href="#">Bar</bit-tab-link>
</bit-tab-nav-bar>`;

const longTitle =
  "LongTitleeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const subtitle = html`<div slot="subtitle">
  Very informative subtitle since the title itself was not enough information to understand the page
</div>`;

const infoSuffix = html`<bit-icon-button
  slot="title-suffix"
  button-type="subtleGhost"
  icon="bwi-info-circle"
  label="A thing"
></bit-icon-button>`;

type Args = { title: string; icon?: string; legacy: boolean };

const header = (args: Args, content: TemplateResult | typeof nothing = nothing) =>
  html`<bit-header title=${args.title} icon=${args.icon ?? nothing} ?legacy=${args.legacy}
    >${content}</bit-header
  >`;

export default {
  title: "Component Library/Header",
  component: "bit-header",
  decorators: [
    (story) => html`<div class="tw-min-h-screen tw-flex-1 tw-p-6 tw-text-main">${story()}</div>`,
  ],
  args: { title: "Foobar", icon: "bwi-bug", legacy: false },
  render: (args) => header(args),
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

const legacy = { legacy: true };

export const KitchenSink: Story = {
  args: { ...legacy, title: longTitle },
  render: (args) =>
    header(
      args,
      html`${breadcrumbs(["Foo", "Bar"])} ${infoSuffix}
        <bit-input placeholder="Ask Jeeves" label="Search"></bit-input>
        <bit-icon-button icon="bwi-grid" label="Switch products"></bit-icon-button>
        <bit-avatar text="Will" size="lg"></bit-avatar>
        <bit-button button-type="primary">New</bit-button>
        <bit-button slot="secondary">Click Me 🎉</bit-button>
        ${tabs}`,
    ),
};

export const KitchenSinkVfo1: Story = {
  args: { title: longTitle },
  render: (args) =>
    header(
      args,
      html`${breadcrumbs(["Foo", "Bar"])} ${infoSuffix} ${subtitle}
        <bit-button>Click Me 🎉</bit-button>
        <bit-button button-type="primary">New</bit-button>
        ${tabs}`,
    ),
};

export const Basic: Story = { args: legacy };

export const WithLongTitle: Story = {
  args: { ...legacy, title: longTitle },
  render: (args) =>
    header(args, html`<i slot="title-suffix" class="bwi bwi-key" aria-hidden="true"></i>`),
};

export const TitleWithSubtitleVfo1: Story = {
  args: { title: longTitle },
  render: (args) =>
    header(
      args,
      html`<i slot="title-suffix" class="bwi bwi-key" aria-hidden="true"></i> ${subtitle}`,
    ),
};

export const BreadcrumbsWithSubtitleVfo1: Story = {
  args: { title: "Fallback Title" },
  render: (args) => header(args, html`${breadcrumbs(["Bar", "Foo"], true)} ${subtitle}`),
};

export const WithBreadcrumbs: Story = {
  args: legacy,
  render: (args) => header(args, breadcrumbs(["Foo", "Bar"])),
};

export const WithBreadcrumbsVfo1: Story = {
  render: (args) => header(args, breadcrumbs(["Foo", "Bar"])),
};

export const WithActiveBreadcrumb: Story = {
  args: legacy,
  render: (args) => header(args, breadcrumbs(["Bar", "Foo"], true)),
};

export const WithActiveBreadcrumbVfo1: Story = {
  render: (args) => header(args, breadcrumbs(["Bar", "Foo"], true)),
};

export const WithSearch: Story = {
  args: legacy,
  render: (args) =>
    header(args, html`<bit-input placeholder="Ask Jeeves" label="Search"></bit-input>`),
};

export const TitleWithPrimaryContent: Story = {
  args: legacy,
  render: (args) => header(args, html`<bit-button button-type="primary">New</bit-button>`),
};

export const TitleWithPrimaryContentVfo1: Story = {
  render: (args) => header(args, html`<bit-button button-type="primary">New</bit-button>`),
};

export const WithSecondaryContent: Story = {
  args: legacy,
  render: (args) => header(args, html`<bit-button slot="secondary">Click Me 🎉</bit-button>`),
};

export const BreadcrumbsWithPrimaryContent: Story = {
  args: legacy,
  render: (args) =>
    header(
      args,
      html`${breadcrumbs(["Bar", "Foo"], true)} <bit-button button-type="primary">New</bit-button>`,
    ),
};

export const BreadcrumbsWithPrimaryContentVfo1: Story = {
  render: (args) =>
    header(
      args,
      html`${breadcrumbs(["Bar", "Foo"], true)} <bit-button button-type="primary">New</bit-button>`,
    ),
};

export const WithTabs: Story = { args: legacy, render: (args) => header(args, tabs) };

export const WithTabsVfo1: Story = { render: (args) => header(args, tabs) };

export const WithPrefixVfo1: Story = {
  args: { title: "My vault", icon: undefined },
  render: (args) =>
    header(
      args,
      html`<bit-icon-tile
        slot="title-prefix"
        icon="bwi-user"
        variant="brand"
        emphasis="bold"
        size="sm"
      ></bit-icon-tile>`,
    ),
};

export const WithTitleSuffixComponent: Story = {
  args: legacy,
  render: (args) =>
    header(
      args,
      html`<bit-icon slot="title-suffix" name="bwi-spinner" class="bwi-spin"></bit-icon>`,
    ),
};

export const WithActiveBreadcrumbAndTitleSuffixVfo1: Story = {
  render: (args) => header(args, html`${breadcrumbs(["Bar", "Foo"], true)} ${infoSuffix}`),
};
