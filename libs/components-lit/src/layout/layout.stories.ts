import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, TemplateResult } from "lit";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";

import type { DialogRef } from "../dialog/dialog-ref";
import { openDrawer } from "../dialog/drawer";
import { positionFixedWrapper, storyNavState } from "../navigation/story-helpers";

import { layoutFooter } from "./layout-footer";
import { collapseOnScroll, scrollCollapseSource } from "./scroll-collapse";
import "./layout";
import "../banner/banner";
import "../button/button";
import "../callout/callout";
import "../dialog/dialog";
import "../header/header";
import "../navigation/nav-group";
import "../navigation/nav-item";
import "../navigation/nav-logo";
import "../navigation/side-nav";

type Args = { legacy: boolean; rounded: boolean };

const layout = (args: Args, nav: TemplateResult, content: TemplateResult) =>
  positionFixedWrapper(
    html`<bit-layout
      ?legacy=${args.legacy}
      ?rounded=${args.rounded}
      .sideNavState=${storyNavState()}
    >
      ${nav} ${content}
    </bit-layout>`,
  );

const groups = html`
  <bit-nav-group text="Hello World (Anchor)" href="#a" icon="bwi-grid">
    <bit-nav-item text="Child A" href="#a" icon="bwi-grid"></bit-nav-item>
    <bit-nav-item text="Child B" href="#b"></bit-nav-item>
    <bit-nav-item text="Child C" href="#c" icon="bwi-grid"></bit-nav-item>
  </bit-nav-group>
  <bit-nav-group text="Lorem Ipsum (Button)" icon="bwi-grid">
    <bit-nav-item text="Child A" icon="bwi-grid"></bit-nav-item>
    <bit-nav-item text="Child B"></bit-nav-item>
    <bit-nav-item text="Child C" icon="bwi-grid"></bit-nav-item>
  </bit-nav-group>
`;

const callout = html`<bit-callout heading="Foobar">Hello world!</bit-callout>`;

export default {
  title: "Component Library/Layout",
  component: "bit-layout",
  args: { legacy: true, rounded: false },
  render: (args) => layout(args, html`<bit-side-nav>${groups}</bit-side-nav>`, callout),
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-51009&t=k6OTDDPZOTtypRqo-11",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

const vfo1 = { legacy: false };

export const Empty: Story = {
  render: (args) => layout(args, html`<bit-side-nav></bit-side-nav>`, html``),
};

export const WithContent: Story = {};

export const WithContentVfo1: Story = { args: vfo1 };

export const StickyHeaderAndFooterVfo1: Story = {
  args: vfo1,
  render: (args) =>
    layout(
      args,
      html`<bit-side-nav>
        <bit-nav-logo
          .openIcon=${PasswordManagerLogo}
          href="#"
          label="Password Manager"
        ></bit-nav-logo>
        <bit-nav-item slot="product-switcher" text="Switcher" icon="bwi-up-down-btn"></bit-nav-item>
        ${Array.from(
          { length: 30 },
          (_, i) =>
            html`<bit-nav-item text="Shared folder ${i}" icon="bwi-shared-folder"></bit-nav-item>`,
        )}
        <bit-nav-item slot="account" text="My account" icon="bwi-user"></bit-nav-item>
      </bit-side-nav>`,
      callout,
    ),
  play: async ({ canvasElement }) => {
    // The nav scrolls itself, not the page; which element scrolls depends on the 600px breakpoint.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const root = canvasElement.querySelector("bit-side-nav")?.shadowRoot;
    const scroller = [
      ...(root?.querySelectorAll<HTMLElement>("[data-nav-column], #bit-side-nav--scroll") ?? []),
    ].find((candidate) => candidate.scrollHeight > candidate.clientHeight);
    if (scroller) {
      scroller.scrollTop = 400;
    }
  },
};

export const HeaderBorderAlwaysVfo1: Story = {
  args: vfo1,
  render: (args) =>
    layout(
      args,
      html`<bit-side-nav header-border="always">
        <bit-nav-logo
          .openIcon=${PasswordManagerLogo}
          href="#"
          label="Admin Console"
        ></bit-nav-logo>
        <bit-nav-item slot="product-switcher" text="Switcher" icon="bwi-up-down-btn"></bit-nav-item>
        <bit-nav-item text="Members" icon="bwi-user"></bit-nav-item>
        <bit-nav-item text="Groups" icon="bwi-users"></bit-nav-item>
      </bit-side-nav>`,
      callout,
    ),
};

/** Tall switcher content scrolls within a capped row so body rows stay reachable. */
export const ExpandedSwitcherVfo1: Story = {
  args: vfo1,
  render: (args) =>
    layout(
      args,
      html`<bit-side-nav header-border="always">
        <bit-nav-logo
          .openIcon=${PasswordManagerLogo}
          href="#"
          label="Admin Console"
        ></bit-nav-logo>
        <bit-nav-group slot="product-switcher" text="Acme Inc." icon="bwi-business" open>
          ${Array.from(
            { length: 20 },
            (_, i) => html`<bit-nav-item text="Organization ${i}"></bit-nav-item>`,
          )}
        </bit-nav-group>
        <bit-nav-item text="Members" icon="bwi-user"></bit-nav-item>
        <bit-nav-item text="Groups" icon="bwi-users"></bit-nav-item>
        <bit-nav-item text="Settings" icon="bwi-cog"></bit-nav-item>
      </bit-side-nav>`,
      callout,
    ),
};

/** Pressing Tab before anything has focus lands on the skip link, which focuses `<main>`. */
export const SkipLinks: Story = {
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    (document.activeElement as HTMLElement | null)?.blur();
    canvasElement.ownerDocument.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );
  },
};

export const Secondary: Story = {
  render: (args) =>
    layout(args, html`<bit-side-nav variant="secondary">${groups}</bit-side-nav>`, callout),
};

export const SecondaryVfo1: Story = { ...Secondary, args: vfo1 };

export const Rounded: Story = { args: { rounded: true } };

export const RoundedVfo1: Story = { args: { ...vfo1, rounded: true } };

const bannerAndHeaderNav = html`<bit-side-nav>
  <bit-nav-item text="Members" icon="bwi-user" href="#members" active></bit-nav-item>
  <bit-nav-item text="Groups" icon="bwi-shared-folder" href="#groups"></bit-nav-item>
</bit-side-nav>`;

export const BannerAndHeader: Story = {
  render: (args) =>
    layout(
      args,
      bannerAndHeaderNav,
      html`<bit-banner>This organization is being accessed by a provider.</bit-banner>
        <div>
          <bit-header title="Members" icon="bwi-user" ?legacy=${args.legacy}>
            <bit-button button-type="primary">Invite member</bit-button>
          </bit-header>
          ${callout}
        </div>`,
    ),
};

export const BannerAndHeaderVfo1: Story = { ...BannerAndHeader, args: vfo1 };

const drawerContent = (ref: DialogRef) =>
  html`<bit-dialog heading="Drawer" dialog-size="default">
    The drawer pushes the main content while there is room, and overlays it on narrow viewports; the
    side nav collapses to its rail first.
    <bit-button slot="footer" button-type="secondary" @click=${() => ref.close()}>Close</bit-button>
  </bit-dialog>`;

/** `openDrawer` content renders in the layout's drawer column (`bit-drawer-outlet`). */
export const WithDrawerVfo1: Story = {
  args: vfo1,
  render: (args) =>
    layout(
      args,
      html`<bit-side-nav>${groups}</bit-side-nav>`,
      html`<bit-header title="Drawer"></bit-header>
        <bit-button button-type="primary" @click=${() => openDrawer(drawerContent)}
          >Open drawer</bit-button
        >`,
    ),
};

/**
 * `layoutFooter.attach(el)` pins content to the bottom of the main column, outside its scroll
 * container. Interactive content opts back in to pointer events.
 */
export const WithFooterVfo1: Story = {
  args: vfo1,
  render: (args) => {
    const bar = document.createElement("div");
    bar.className =
      "tw-pointer-events-auto tw-absolute tw-bottom-4 tw-inset-x-10 tw-rounded-xl tw-bg-bg-secondary tw-p-3 tw-shadow-lg";
    bar.textContent = "3 items selected";
    layoutFooter.attach(bar);
    return layout(
      args,
      html`<bit-side-nav>${groups}</bit-side-nav>`,
      html`${Array.from({ length: 40 }, (_, i) => html`<p>Row ${i}</p>`)}`,
    );
  },
};

/**
 * `collapseOnScroll()` collapses a region while the page scrolls down and restores it on the way
 * back up. `scrollCollapseSource()` marks a container whose own scroller drives it instead of
 * `<main>`. The bottom-most expanded region draws the seam once the page has scrolled.
 */
export const CollapseOnScrollVfo1: Story = {
  args: vfo1,
  render: (args) =>
    layout(
      args,
      html`<bit-side-nav>${groups}</bit-side-nav>`,
      html`<div class="tw-flex tw-h-full tw-flex-col">
        <div ${collapseOnScroll({ enabled: true })}>
          <div class="tw-py-4">Collapsing filters region</div>
        </div>
        <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto" ${scrollCollapseSource()}>
          ${Array.from({ length: 60 }, (_, i) => html`<p>Row ${i}</p>`)}
        </div>
      </div>`,
    ),
};
