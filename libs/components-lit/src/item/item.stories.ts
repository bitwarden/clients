import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../avatar/avatar";
import "../badge/badge";
import "../button/button";
import "../chips/chip-action/chip-action";
import "../icon-button/icon-button";
import "../link/link";
import "./item";
import "./item-content";

type Args = { size: "base" | "lg" };

const actions = html`
  <bit-item-action slot="end">
    <bit-chip-action variant="primary" label="Fill"></bit-chip-action>
  </bit-item-action>
  <bit-item-action slot="end">
    <bit-icon-button icon="bwi-clone" size="small" label="Clone"></bit-icon-button>
  </bit-item-action>
  <bit-item-action slot="end">
    <bit-icon-button icon="bwi-ellipsis-v" size="small" label="More options"></bit-icon-button>
  </bit-item-action>
`;

const globe = html`<i
  slot="start"
  class="bwi bwi-globe tw-text-2xl tw-text-muted"
  aria-hidden="true"
></i>`;

const actionItem = html`
  <bit-item>
    <bit-item-content button>
      ${globe} Foo
      <span slot="secondary">Bar</span>
    </bit-item-content>
    ${actions}
  </bit-item>
`;

const multipleActionList = html`
  <bit-item-group aria-label="Multiple action list">
    ${actionItem} ${actionItem} ${actionItem} ${actionItem} ${actionItem} ${actionItem}
  </bit-item-group>
`;

const long =
  "Helloooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo!";
const longSecondary =
  "Worlddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd!";

export default {
  title: "Component Library/Item",
  component: "bit-item",
  args: { size: "base" },
  argTypes: { size: { control: "radio", options: ["base", "lg"] } },
  decorators: [(story) => html`<div class="tw-bg-background-alt tw-p-2">${story()}</div>`],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-37011&t=b5tDKylm5sWm2yKo-11",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {
  render: (args) => html`
    <bit-item size=${args.size}>
      <bit-item-content button>
        ${globe} Foo
        <span slot="secondary">Bar</span>
      </bit-item-content>
      ${actions}
    </bit-item>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <bit-item size="base">
      <bit-item-content button>${globe} Base</bit-item-content>
    </bit-item>
    <bit-item size="lg">
      <bit-item-content button>${globe} Large</bit-item-content>
    </bit-item>
  `,
};

export const ContentSlots: Story = {
  render: () => html`
    <bit-item>
      <bit-item-content button>
        <bit-avatar slot="start" text="Foo" size="lg"></bit-avatar>
        foo@bitwarden.com
        <div slot="secondary">Bitwarden.com</div>
        <div slot="secondary"><em>locked</em></div>
        <i slot="end" class="bwi bwi-lock" aria-hidden="true"></i>
      </bit-item-content>
    </bit-item>
  `,
};

export const ContentTypes: Story = {
  render: () => html`
    <bit-item>
      <bit-item-content href="#">Hi, I am a link.</bit-item-content>
    </bit-item>
    <bit-item>
      <bit-item-content button>And I am a button.</bit-item-content>
    </bit-item>
    <bit-item>
      <bit-item-content button disabled title="I'm a disabled button"
        >And I am a disabled button.</bit-item-content
      >
    </bit-item>
    <bit-item>
      <bit-item-content>I'm just static :(</bit-item-content>
    </bit-item>
  `,
};

export const TextOverflowTruncate: Story = {
  render: () => html`
    <bit-item>
      <bit-item-content>
        ${globe} ${long}
        <span slot="secondary">${longSecondary}</span>
      </bit-item-content>
      <bit-item-action slot="end">
        <bit-icon-button icon="bwi-clone" size="small" label="Clone"></bit-icon-button>
      </bit-item-action>
      <bit-item-action slot="end">
        <bit-icon-button icon="bwi-ellipsis-v" size="small" label="More options"></bit-icon-button>
      </bit-item-action>
    </bit-item>
  `,
};

export const TextOverflowWrap: Story = {
  render: () => html`
    <bit-item>
      <bit-item-content no-truncate>
        ${globe} ${long}
        <span slot="secondary">${longSecondary}</span>
      </bit-item-content>
      <bit-item-action slot="end">
        <bit-icon-button icon="bwi-clone" size="small" label="Clone"></bit-icon-button>
      </bit-item-action>
      <bit-item-action slot="end">
        <bit-icon-button icon="bwi-ellipsis-v" size="small" label="More options"></bit-icon-button>
      </bit-item-action>
    </bit-item>
  `,
};

export const MultipleActionList: Story = { render: () => multipleActionList };

const linkItem = html`
  <bit-item>
    <bit-item-content href="#">
      Foobar
      <i slot="end" class="bwi bwi-angle-right" aria-hidden="true"></i>
    </bit-item-content>
  </bit-item>
`;

export const SingleActionList: Story = {
  render: () => html`
    <bit-item-group aria-label="Single action list">
      ${linkItem} ${linkItem} ${linkItem} ${linkItem} ${linkItem} ${linkItem}
    </bit-item-group>
  `,
};

export const SingleActionWithBadge: Story = {
  render: () => html`
    <bit-item-group aria-label="Single action with badge">
      <bit-item>
        <bit-item-content href="#">
          Foobar
          <bit-badge variant="primary" slot="default-trailing">Fill</bit-badge>
          <i slot="end" class="bwi bwi-angle-right" aria-hidden="true"></i>
        </bit-item-content>
      </bit-item>
      <bit-item>
        <bit-item-content href="#">
          ${long}
          <bit-badge variant="primary" slot="default-trailing">Fill</bit-badge>
          <i slot="end" class="bwi bwi-angle-right" aria-hidden="true"></i>
        </bit-item-content>
      </bit-item>
    </bit-item-group>
  `,
};

export const CompactMode: Story = {
  render: () => html`<div class="bit-compact">${multipleActionList}</div>`,
};

/**
 * Angular's story uses the CDK virtual scroll viewport. There's no virtualizer in this library,
 * so this renders a long list in a scroll container.
 */
export const VirtualScrolling: Story = {
  render: () => html`
    <div class="tw-h-[500px] tw-overflow-auto">
      <bit-item-group aria-label="Long list">
        ${Array.from(
          { length: 1000 },
          (_, i) => html`
            <bit-item>
              <bit-item-content button>${globe} ${i}</bit-item-content>
              ${actions}
            </bit-item>
          `,
        )}
      </bit-item-group>
    </div>
  `,
};

export const EndSlotSpacing: Story = {
  render: () => html`
    <bit-item-group aria-label="End slot spacing">
      <bit-item>
        <bit-item-content>Every content type at once</bit-item-content>
        <span slot="end">Updated today</span>
        <bit-link slot="end" href="#">Manage</bit-link>
        <bit-badge slot="end" variant="subtle">Shared</bit-badge>
        ${actions}
      </bit-item>
      <bit-item>
        <bit-item-content>Text, badge, then two icon buttons</bit-item-content>
        <span slot="end">Updated today</span>
        <bit-badge slot="end" variant="subtle">Shared</bit-badge>
        <bit-item-action slot="end">
          <bit-icon-button icon="bwi-clone" size="small" label="Clone"></bit-icon-button>
        </bit-item-action>
        <bit-item-action slot="end">
          <bit-icon-button
            icon="bwi-ellipsis-v"
            size="small"
            label="More options"
          ></bit-icon-button>
        </bit-item-action>
      </bit-item>
      <bit-item>
        <bit-item-content>Two plain text nodes</bit-item-content>
        <span slot="end">Foo</span>
        <span slot="end">Bar</span>
      </bit-item>
      <bit-item>
        <bit-item-content>Link next to an icon button</bit-item-content>
        <bit-link slot="end" href="#">Manage</bit-link>
        <bit-item-action slot="end">
          <bit-icon-button
            icon="bwi-ellipsis-v"
            size="small"
            label="More options"
          ></bit-icon-button>
        </bit-item-action>
      </bit-item>
      <bit-item>
        <bit-item-content>Icon buttons wrapped at different depths</bit-item-content>
        <bit-item-action slot="end">
          <bit-icon-button icon="bwi-clone" size="small" label="Clone"></bit-icon-button>
        </bit-item-action>
        <div slot="end">
          <bit-item-action>
            <bit-icon-button icon="bwi-external-link" size="small" label="Launch"></bit-icon-button>
          </bit-item-action>
        </div>
        <bit-item-action slot="end">
          <bit-icon-button
            icon="bwi-ellipsis-v"
            size="small"
            label="More options"
          ></bit-icon-button>
        </bit-item-action>
      </bit-item>
      <bit-item>
        <bit-item-content>Button next to a badge and plain text</bit-item-content>
        <span slot="end">Updated today</span>
        <bit-badge slot="end" variant="subtle">Shared</bit-badge>
        <bit-button slot="end" button-type="secondary" size="small">Manage</bit-button>
      </bit-item>
      <bit-item>
        <bit-item-content>Chip next to two badges</bit-item-content>
        <bit-item-action slot="end">
          <bit-chip-action variant="primary" label="Fill"></bit-chip-action>
        </bit-item-action>
        <bit-badge slot="end" variant="subtle">One</bit-badge>
        <bit-badge slot="end" variant="subtle">Two</bit-badge>
      </bit-item>
    </bit-item-group>
  `,
};
