import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { inLayout, LayoutStoryArgs } from "./story-helpers";
import "./nav-item";
import "./nav-section";
import "./nav-section-empty";
import "./side-nav";
import "../chips/chip-action/chip-action";
import "../layout/layout";

type Args = LayoutStoryArgs;

export default {
  title: "Component Library/Nav/Nav Section",
  component: "bit-nav-section",
  decorators: [(story, { args }) => inLayout(args as Args, story() as never)],
  args: { legacy: false },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {
  render: () => html`
    <bit-nav-section label="Manage" icon="bwi-shared-folder">
      <bit-nav-item text="My folders" href="#folders" icon="bwi-folder"></bit-nav-item>
      <bit-nav-item text="Archive" href="#archive" icon="bwi-archive">
        <bit-chip-action
          slot="end"
          start-icon="bwi-diamond"
          label="Premium"
          size="small"
        ></bit-chip-action>
      </bit-nav-item>
      <bit-nav-item text="Trash" href="#trash" icon="bwi-trash"></bit-nav-item>
      <bit-nav-item text="Settings" href="#settings" icon="bwi-cog"></bit-nav-item>
    </bit-nav-section>
  `,
};

/**
 * A section with no items renders an empty state via `bit-nav-section-empty`. The close button is
 * only shown when `dismissible` is set; it fires `dismiss`.
 */
export const EmptyState: Story = {
  render: () => html`
    <bit-nav-section label="Pinned" icon="bwi-pin">
      <bit-nav-section-empty
        dismissible
        @dismiss=${(e: Event) => (e.target as HTMLElement).remove()}
      >
        Find a shared folder in this vault and select <b>Pin to sidebar</b> from the Options menu.
      </bit-nav-section-empty>
    </bit-nav-section>
  `,
};
