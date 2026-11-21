import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { positionFixedWrapper, storyNavState } from "../navigation/story-helpers";
import { typography } from "../typography/typography";
import "./layout";
import "./page";
import "../button/button";
import "../header/header";
import "../navigation/nav-item";
import "../navigation/side-nav";

type Args = { legacy: boolean };

export default {
  title: "Component Library/Layout/Page",
  component: "bit-page",
  args: { legacy: true },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

const rows = [...Array(60).keys()];

/**
 * `bit-page` fills `bit-layout`'s main content area as a full-height flex column whose body fills
 * the remaining height and scrolls.
 */
export const Default: Story = {
  render: (args) =>
    positionFixedWrapper(
      html`<bit-layout ?legacy=${args.legacy} .sideNavState=${storyNavState()}>
        <bit-side-nav></bit-side-nav>
        <bit-page>
          <div class="tw-mb-4 tw-flex tw-items-center tw-justify-between">
            <h1 class="${typography("h1")} tw-mb-0">Page title</h1>
            <bit-button button-type="primary">Action</bit-button>
          </div>
          ${rows.map(
            (row) =>
              html`<p class=${typography("body1")}>
                Row ${row} — the body fills the page height and scrolls.
              </p>`,
          )}
        </bit-page>
      </bit-layout>`,
    ),
};

export const WithHeaderVfo1: Story = {
  args: { legacy: false },
  render: (args) =>
    positionFixedWrapper(
      html`<bit-layout ?legacy=${args.legacy} .sideNavState=${storyNavState()}>
        <bit-side-nav>
          <bit-nav-item text="Vault" icon="bwi-lock" href="#" active></bit-nav-item>
        </bit-side-nav>
        <bit-page>
          <bit-header title="Page title" icon="bwi-lock">
            <bit-button button-type="primary">Action</bit-button>
          </bit-header>
          ${rows.map((row) => html`<p class=${typography("body1")}>Row ${row}</p>`)}
        </bit-page>
      </bit-layout>`,
    ),
};
