import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, LitElement, TemplateResult } from "lit";

import type { BreadcrumbSize } from "./breadcrumb";
import "./breadcrumb";
import "./breadcrumbs";
import "../icon-tile/icon-tile";

type Args = { size: BreadcrumbSize; showTrailingArrow: boolean };

/**
 * Story-only stand-in for the app router: marks the crumb whose `href` matches the URL hash as
 * `current`, and renders the "routed" page content below.
 */
class StoryHashRouter extends LitElement {
  static properties = { content: { type: Boolean }, path: { state: true } };
  content = false;
  path = "";

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!location.hash) {
      history.replaceState(null, "", "#/vault");
    }
    window.addEventListener("hashchange", this.sync);
    this.sync();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("hashchange", this.sync);
  }

  private sync = () => {
    this.path = location.hash.slice(1);
    this.querySelectorAll("bit-breadcrumb").forEach((crumb) => {
      crumb.current = crumb.getAttribute("href") === location.hash;
    });
  };

  render() {
    return this.content
      ? html`<div class="tw-mt-5">Some really cool content for ${this.path}</div>`
      : html``;
  }
}
if (!customElements.get("story-hash-router")) {
  customElements.define("story-hash-router", StoryHashRouter);
}

// eslint-disable-next-line no-console
const clickHandler = () => console.log("clicked!");

const breadcrumbs = (args: Args, crumbs: TemplateResult) =>
  html`<bit-breadcrumbs size=${args.size} ?show-trailing-arrow=${args.showTrailingArrow}>
    ${crumbs}
  </bit-breadcrumbs>`;

const routed = (args: Args, crumbs: TemplateResult) =>
  html`<story-hash-router content>${breadcrumbs(args, crumbs)}</story-hash-router>`;

export default {
  title: "Component Library/Breadcrumbs",
  component: "bit-breadcrumbs",
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-26962&t=b5tDKylm5sWm2yKo-4",
    },
  },
  args: {
    size: "base",
    showTrailingArrow: false,
  },
  argTypes: {
    size: {
      table: { defaultValue: { summary: "base" } },
      control: { type: "radio" },
      options: ["small", "base"],
    },
    showTrailingArrow: {
      control: { type: "boolean" },
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {
  render: (args) =>
    routed(
      args,
      html`<bit-breadcrumb icon="bwi-vault" href="#/vault">Vault</bit-breadcrumb>
        <bit-breadcrumb href="#/acme-corp">ACME Corp</bit-breadcrumb>
        <bit-breadcrumb href="#/groups">Groups</bit-breadcrumb>
        <bit-breadcrumb href="#/members">Members</bit-breadcrumb>`,
    ),
};

export const Small: Story = {
  ...Default,
  args: {
    size: "small",
  },
};

export const WithStartSlot: Story = {
  render: (args) =>
    routed(
      args,
      html`<bit-breadcrumb href="#/vault">
          <bit-icon-tile slot="start" icon="bwi-vault"></bit-icon-tile>
          Vault
        </bit-breadcrumb>
        <bit-breadcrumb href="#/acme-corp">
          <bit-icon-tile slot="start" icon="bwi-business" variant="success"></bit-icon-tile>
          ACME Corp
        </bit-breadcrumb>
        <bit-breadcrumb href="#/groups">
          <bit-icon-tile slot="start" icon="bwi-users" variant="warning"></bit-icon-tile>
          Groups
        </bit-breadcrumb>
        <bit-breadcrumb href="#/members">
          <bit-icon-tile slot="start" icon="bwi-user" variant="danger"></bit-icon-tile>
          Members
        </bit-breadcrumb>`,
    ),
};

export const WithStartSlotSmall: Story = {
  ...WithStartSlot,
  args: {
    size: "small",
  },
};

export const DefaultAsButtons: Story = {
  render: (args) =>
    breadcrumbs(
      args,
      html`<bit-breadcrumb icon="bwi-vault" @click=${clickHandler}>Vault</bit-breadcrumb>
        <bit-breadcrumb @click=${clickHandler}>ACME Corp</bit-breadcrumb>
        <bit-breadcrumb @click=${clickHandler}>Groups</bit-breadcrumb>
        <bit-breadcrumb @click=${clickHandler}>Members</bit-breadcrumb>`,
    ),
};

export const OverflowLinks: Story = {
  render: (args) =>
    routed(
      args,
      html`<bit-breadcrumb href="#/vault">Vault</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" href="#/acme-corp">ACME Corp</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" href="#/groups">Groups</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" href="#/members">Members</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" href="#/items">Items</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" href="#/sends">Sends</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" href="#/settings">Settings</bit-breadcrumb>`,
    ),
};

export const OverflowButtons: Story = {
  render: (args) =>
    breadcrumbs(
      args,
      html`<bit-breadcrumb @click=${clickHandler}>Vault</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" @click=${clickHandler}>ACME Corp</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" @click=${clickHandler}>Groups</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" @click=${clickHandler}>Members</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" @click=${clickHandler}>Items</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" @click=${clickHandler}>Sends</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-shared-folder" @click=${clickHandler}>Settings</bit-breadcrumb>`,
    ),
};

export const WithTrailingArrow: Story = {
  render: (args) =>
    breadcrumbs(
      args,
      html`<bit-breadcrumb icon="bwi-vault" href="#/unknown-route">Breadcrumb</bit-breadcrumb>
        <bit-breadcrumb href="#/unknown-route-2">Breadcrumb 2</bit-breadcrumb>
        <bit-breadcrumb href="#/unknown-route-3">Breadcrumb 3</bit-breadcrumb>
        <bit-breadcrumb href="#/unknown-route-4">Breadcrumb 4</bit-breadcrumb>`,
    ),
  args: {
    showTrailingArrow: true,
  },
};

export const ResponsiveOverflow: Story = {
  render: (args) =>
    html`<div
      class="tw-resize-x tw-overflow-auto tw-rounded tw-border tw-border-solid tw-border-secondary-300 tw-p-3"
      style="width: 600px; max-width: 100%;"
    >
      ${routed(
        args,
        html`<bit-breadcrumb href="#/vault">Single sign-on</bit-breadcrumb>
          <bit-breadcrumb href="#/acme-corp">Page name</bit-breadcrumb>
          <bit-breadcrumb href="#/groups">Page name</bit-breadcrumb>
          <bit-breadcrumb href="#/members">Page name</bit-breadcrumb>
          <bit-breadcrumb href="#/items">Page name</bit-breadcrumb>
          <bit-breadcrumb href="#/settings"
            >Configure single sign-on for your enterprise organization</bit-breadcrumb
          >`,
      )}
    </div>`,
};

/** Interaction: a trail of fixed width with the "More" menu opened. */
export const OverflowMenuOpen: Story = {
  render: (args) =>
    html`<div class="tw-h-72" style="width: 360px">
      ${OverflowLinks.render!(args, {} as never)}
    </div>`,
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const trail = canvasElement.querySelector("bit-breadcrumbs");
    trail?.shadowRoot?.querySelector<HTMLElement>("bit-icon-button")?.click();
  },
};
