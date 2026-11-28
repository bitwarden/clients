import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../section/section";
import "./card";

const lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex.";

export default {
  title: "Component Library/Cards/Card",
  component: "bit-card",
  decorators: [
    (story) => html`<div class="tw-bg-background-alt tw-p-10 tw-text-main">${story()}</div>`,
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-28355&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta;

type Story = StoryObj;

/** Cards are presentational containers. */
export const Default: Story = {
  render: () => html`
    <bit-card>
      <p class="tw-text-base !tw-mb-0">${lorem}</p>
    </bit-card>
  `,
};

/** Cards are often paired with Sections. */
export const WithinSections: Story = {
  render: () => html`
    ${[1, 2, 3].map(
      () => html`
        <bit-section>
          <h2 class="tw-text-base tw-font-medium tw-text-main tw-mb-1.5">Bar</h2>
          <bit-card>
            <p class="tw-text-base !tw-mb-0">${lorem}</p>
          </bit-card>
        </bit-section>
      `,
    )}
  `,
};

/**
 * A segmented card draws a full-width divider between each direct child. It makes no
 * assumptions about segment content — each segment owns its own padding and layout.
 * `<bit-card-content>` is used here as a convenient way to supply the standard card padding.
 */
export const Segmented: Story = {
  render: () => html`
    <bit-card-segmented class="tw-max-w-2xl">
      <bit-card-content>
        <h3 class="tw-text-lg tw-font-medium tw-text-main !tw-mb-1">Section one</h3>
        <p class="tw-text-base !tw-mb-0">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
      </bit-card-content>
      <bit-card-content>
        <h3 class="tw-text-lg tw-font-medium tw-text-main !tw-mb-1">Section two</h3>
        <p class="tw-text-base !tw-mb-0">
          Interdum et malesuada fames ac ante ipsum primis in faucibus.
        </p>
      </bit-card-content>
      <bit-card-content>
        <h3 class="tw-text-lg tw-font-medium tw-text-main !tw-mb-1">Section three</h3>
        <p class="tw-text-base !tw-mb-0">Nunc elementum odio nibh.</p>
      </bit-card-content>
    </bit-card-segmented>
  `,
};
