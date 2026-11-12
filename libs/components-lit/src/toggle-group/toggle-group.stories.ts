import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import "../berry/berry";
import "../card/card";
import "./toggle";
import "./toggle-group";

type Args = { selected?: string; fullWidth: boolean };

export default {
  title: "Component Library/Toggle Group",
  component: "bit-toggle-group",
  args: { selected: "all", fullWidth: false },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=1881-17157&t=b5tDKylm5sWm2yKo-4",
    },
    a11y: {
      config: {
        rules: [
          {
            // axe cannot determine the background under label text because the active-toggle
            // indicator is rendered as an ::after pseudo-element on the parent. Contrast is
            // validated by the design tokens.
            id: "color-contrast",
            enabled: false,
          },
        ],
      },
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {
  render: (args) => html`
    <bit-toggle-group selected=${args.selected ?? nothing} label="People list filter">
      <bit-toggle value="all">All <bit-berry value="3" variant="danger"></bit-berry></bit-toggle>
      <bit-toggle value="invited">Invited</bit-toggle>
      <bit-toggle value="accepted"
        >Accepted <bit-berry value="2" variant="danger"></bit-berry
      ></bit-toggle>
      <bit-toggle value="deactivated"
        >Deactivated <bit-berry value="0" variant="danger"></bit-berry
      ></bit-toggle>
    </bit-toggle-group>
  `,
};

export const FullWidth: Story = {
  args: { fullWidth: true },
  render: (args) => html`
    <bit-toggle-group
      selected=${args.selected ?? nothing}
      label="People list filter"
      ?full-width=${args.fullWidth}
    >
      <bit-toggle value="all">All <bit-berry value="3"></bit-berry></bit-toggle>
      <bit-toggle value="invited">Invited</bit-toggle>
      <bit-toggle value="accepted">Accepted <bit-berry value="2"></bit-berry></bit-toggle>
      <bit-toggle value="deactivated">Deactivated</bit-toggle>
    </bit-toggle-group>
  `,
};

export const Inline: Story = {
  render: (args) => html`
    <bit-card>
      <bit-toggle-group selected=${args.selected ?? nothing} label="People list filter" inline>
        <bit-toggle value="all">All</bit-toggle>
        <bit-toggle value="invited">Invited</bit-toggle>
        <bit-toggle value="accepted">Accepted</bit-toggle>
      </bit-toggle-group>
    </bit-card>
  `,
};

/** With no `selected`, the first toggle is selected. */
export const UnsetSelection: Story = {
  args: { selected: undefined },
  render: () => html`
    <bit-toggle-group label="People list filter">
      <bit-toggle value="all">All</bit-toggle>
      <bit-toggle value="invited">Invited</bit-toggle>
      <bit-toggle value="accepted">Accepted</bit-toggle>
      <bit-toggle value="deactivated">Deactivated</bit-toggle>
    </bit-toggle-group>
  `,
};

const overflowGroup = (selected?: string) => html`
  <bit-toggle-group selected=${selected ?? nothing} label="Status filter">
    <bit-toggle value="all">All<bit-berry value="3" variant="danger"></bit-berry></bit-toggle>
    <bit-toggle value="invited">Invited</bit-toggle>
    <bit-toggle value="accepted"
      >Accepted <bit-berry value="2" variant="danger"></bit-berry
    ></bit-toggle>
    <bit-toggle value="deactivated">Deactivated</bit-toggle>
  </bit-toggle-group>
`;

export const Overflow: Story = {
  render: (args) => html`
    <p class="tw-text-sm tw-mb-2 tw-text-fg-muted">
      Resize the browser window (or drag the corner) to see inline → full-width → dropdown
      transitions.
    </p>
    <div
      class="tw-resize-x tw-overflow-hidden tw-border tw-border-solid tw-border-secondary-300 tw-p-2"
      style="width: 560px; max-width: 100%;"
    >
      ${overflowGroup(args.selected)}
    </div>
  `,
};

/** Too narrow for the toggles: the group renders as a dropdown. */
export const Dropdown: Story = {
  render: (args) => html`<div style="width: 240px">${overflowGroup(args.selected)}</div>`,
};

/** Submits `selected` under `name` with its form. */
export const InForm: Story = {
  render: (args) => html`
    <form
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const output = form.querySelector("output");
        if (output) {
          output.textContent = JSON.stringify(Object.fromEntries(new FormData(form)));
        }
      }}
    >
      <bit-toggle-group name="status" selected=${args.selected ?? nothing} label="Status">
        <bit-toggle value="all">All</bit-toggle>
        <bit-toggle value="invited">Invited</bit-toggle>
        <bit-toggle value="accepted">Accepted</bit-toggle>
      </bit-toggle-group>
      <div class="tw-mt-2"><button type="submit">Submit</button> <output></output></div>
    </form>
  `,
};
