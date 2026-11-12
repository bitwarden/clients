import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../../button/button";
import { fullWidthArgType, sharedArgTypes } from "../shared/shared-story-arg-types";

import "./chip-filter";
import type { ChipFilterOption } from "./chip-filter";

type Args = {
  options: ChipFilterOption<string>[];
  value?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  startIcon?: string;
};

export const basicOptionsData: ChipFilterOption<string>[] = [
  { label: "Foo", value: "foo", icon: "bwi-folder" },
  {
    label: "Bar",
    value: "bar",
    icon: "bwi-exclamation-triangle",
    iconClass: "tw-text-danger",
  },
  { label: "Baz", value: "baz", disabled: true },
];

const nestedOptions: ChipFilterOption<string>[] = [
  {
    label: "Foo",
    value: "foo",
    icon: "bwi-folder",
    children: [
      {
        label: "Foo1 very long name of folder but even longer than you thought",
        value: "foo1",
        icon: "bwi-folder",
        children: [
          {
            label: "Foo2",
            value: "foo2",
            icon: "bwi-folder",
            children: [{ label: "Foo3", value: "foo3" }],
          },
        ],
      },
    ],
  },
  { label: "Bar", value: "bar", icon: "bwi-folder" },
  { label: "Baz", value: "baz", icon: "bwi-folder" },
];

const openFirstChip = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const chip = canvasElement.querySelector("bit-chip-filter");
  await chip?.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  chip?.shadowRoot?.querySelector<HTMLElement>("[part=trigger]")?.click();
};

export default {
  title: "Component Library/Chips/Chip Filter (Deprecated)",
  component: "bit-chip-filter",
  excludeStories: /.*Data$/,
  argTypes: { ...sharedArgTypes, ...fullWidthArgType },
  args: { options: basicOptionsData, value: "foo", disabled: false },
  render: (args) => html`
    <bit-chip-filter
      placeholder-text="Folder"
      placeholder-icon="bwi-folder"
      .options=${args.options}
      ?disabled=${args.disabled}
    ></bit-chip-filter>
    <bit-chip-filter
      placeholder-text="Folder"
      placeholder-icon="bwi-folder"
      .options=${args.options}
      .value=${args.value ?? null}
      ?disabled=${args.disabled}
    ></bit-chip-filter>
  `,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-29548&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

const single = (args: Args, extra = html``) =>
  html`<div class="tw-h-60">
    <bit-chip-filter
      placeholder-text="Folder"
      placeholder-icon="bwi-folder"
      .options=${args.options}
      .value=${args.value ?? null}
    ></bit-chip-filter>
    ${extra}
  </div>`;

export const MenuOpen: Story = {
  args: { value: undefined },
  render: (args) => single(args),
  play: openFirstChip,
};

export const FullWidth: Story = {
  args: { value: undefined },
  render: (args) =>
    html`<bit-chip-filter
      placeholder-text="Folder"
      placeholder-icon="bwi-folder"
      .options=${args.options}
      full-width
    ></bit-chip-filter>`,
};

export const NestedOptions: Story = {
  args: { options: nestedOptions, value: "foo1" },
};

/**
 * An option's `iconTile` renders in place of its `icon`, at `size="xs"` so every row lines up. A
 * disabled option's tile drops to the neutral `gray` family.
 */
export const IconTiles: Story = {
  ...MenuOpen,
  args: {
    value: undefined,
    options: [
      { label: "Login", value: "login", iconTile: { icon: "bwi-globe", variant: "brand" } },
      { label: "Card", value: "card", iconTile: { icon: "bwi-credit-card", variant: "teal" } },
      {
        label: "Note with a custom color",
        value: "note",
        iconTile: { icon: "bwi-sticky-note", color: "#f8e71c" },
      },
      {
        label: "SSH key",
        value: "sshKey",
        iconTile: { icon: "bwi-key", variant: "green" },
        disabled: true,
      },
    ],
  },
  parameters: { chromatic: { disableSnapshot: true } },
};

export const TextOverflow: Story = {
  args: {
    options: [{ label: "Fooooooooooooooooooooooooooooooooooooooooooooo", value: "foo" }],
    value: "foo",
  },
};

export const Inactive: Story = {
  args: { options: [{ label: "Foo", value: "foo", icon: "bwi-folder" }], disabled: true },
};

/** Form-associated: the selected value is submitted under `name`, and `required` validates. */
export const InForm: Story = {
  args: { value: undefined },
  render: (args) =>
    html`<form
      class="tw-h-60"
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        form.querySelector("output")!.textContent = JSON.stringify(
          Object.fromEntries(new FormData(form)),
        );
      }}
    >
      <bit-chip-filter
        name="folder"
        placeholder-text="Folder"
        placeholder-icon="bwi-folder"
        .options=${args.options}
      ></bit-chip-filter>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
      <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
    </form>`,
};
