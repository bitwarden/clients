import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../card/card";
import "../icon-button/icon-button";
import "../item/item";
import "../item/item-content";
import { typography } from "../typography/typography";

import "./section";
import "./section-header";

const lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex.";

const h6 = typography("h6");

export default {
  title: "Component Library/Section",
  component: "bit-section",
  decorators: [(story) => html`<div class="tw-text-main">${story()}</div>`],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21666-19363&t=k6OTDDPZOTtypRqo-11",
    },
  },
} satisfies Meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    ${["Foo", "Bar", "Baz"].map(
      (title, i) => html`
        <bit-section ?disable-margin=${i === 2}>
          <bit-section-header>
            <h2 class=${typography("h2")}>${title}</h2>
          </bit-section-header>
          <p class=${typography("body1")}>${lorem}</p>
        </bit-section>
      `,
    )}
  `,
};

export const HeaderVariants: Story = {
  render: () => html`
    <bit-section-header>
      <h2 class=${h6}>Title only</h2>
    </bit-section-header>
    <bit-section-header>
      <h2 class=${h6}>Title with icon button suffix</h2>
      <bit-icon-button icon="bwi-refresh" label="Refresh" size="small"></bit-icon-button>
    </bit-section-header>
  `,
};

export const HeaderEndSlotVariants: Story = {
  render: () => html`
    <bit-section-header>
      <h2 class=${h6}>Title with end slot text</h2>
      <span class=${typography("body2")} slot="end">13</span>
    </bit-section-header>
    <bit-section-header>
      <h2 class=${h6}>Title with end slot icon button</h2>
      <bit-icon-button icon="bwi-star" label="Favorite" size="small" slot="end"></bit-icon-button>
    </bit-section-header>
  `,
};

const header = (title: string) => html`
  <bit-section-header>
    <h2 class=${h6}>${title}</h2>
    <bit-icon-button icon="bwi-star" label="Favorite" size="small" slot="end"></bit-icon-button>
  </bit-section-header>
`;

export const HeaderWithPadding: Story = {
  render: () => html`
    <div class="tw-bg-background-alt tw-p-2">
      <bit-section>
        ${header("Card as immediate sibling")}
        <bit-card><h3 class=${typography("h3")}>bit-section-header has padding</h3></bit-card>
      </bit-section>
      <bit-section>
        ${header("Card nested in immediate sibling")}
        <div>
          <bit-card><h3 class=${typography("h3")}>bit-section-header has padding</h3></bit-card>
        </div>
      </bit-section>
      <bit-section>
        ${header("Item as immediate sibling")}
        <bit-item>
          <bit-item-content class=${typography("body1")}
            >bit-section-header has padding</bit-item-content
          >
        </bit-item>
      </bit-section>
      <bit-section>
        ${header("Item nested in immediate sibling")}
        <bit-item-group>
          <bit-item>
            <bit-item-content class=${typography("body1")}
              >bit-section-header has padding</bit-item-content
            >
          </bit-item>
        </bit-item-group>
      </bit-section>
    </div>
  `,
};

export const HeaderWithoutPadding: Story = {
  render: () => html`
    <div class="tw-bg-background-alt tw-p-2">
      <bit-section>
        ${header("No card or item used")}
        <div>
          <h3 class=${typography("h3")}>just a div, so bit-section-header has no padding</h3>
        </div>
      </bit-section>
      <bit-section>
        ${header("Card nested in non-immediate sibling")}
        <div class="tw-text-main">a div here</div>
        <bit-card><h3 class=${typography("h3")}>bit-section-header has no padding</h3></bit-card>
      </bit-section>
    </div>
  `,
};
