import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { PasswordManagerLogo, SideNavLogoBeta } from "@bitwarden/assets/svg";

import { inLayout, LayoutStoryArgs } from "./story-helpers";
import "./nav-logo";
import "./side-nav";
import "../layout/layout";

type Args = LayoutStoryArgs & { beta: boolean };

export default {
  title: "Component Library/Nav/Nav Logo",
  component: "bit-nav-logo",
  decorators: [(story, { args }) => inLayout(args as Args, story() as never)],
  args: { legacy: true, beta: false },
  render: () =>
    html`<bit-nav-logo
      .openIcon=${PasswordManagerLogo}
      href="#"
      label="Password Manager"
    ></bit-nav-logo>`,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const Dark: Story = { globals: { theme: "dark" } };

/**
 * Beta variant of the logo. The VFO1 nav picks it with `beta` (Angular reads the build-time
 * `prereleaseBuild` flag); this story feeds `SideNavLogoBeta` through `openIcon` in the legacy nav
 * to preview the asset itself.
 */
export const Beta: Story = {
  render: () =>
    html`<bit-nav-logo
      .openIcon=${SideNavLogoBeta}
      href="#"
      label="Password Manager"
    ></bit-nav-logo>`,
};

export const BetaDark: Story = { ...Beta, globals: { theme: "dark" } };

export const Vfo1: Story = { args: { legacy: false } };

export const BetaVfo1: Story = {
  args: { legacy: false },
  render: () => html`<bit-nav-logo beta href="#" label="Password Manager"></bit-nav-logo>`,
};
