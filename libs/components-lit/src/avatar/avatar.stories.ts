import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import "./avatar";

type Args = {
  color?: string;
  avatarId?: string;
  text?: string;
  label?: string;
  size: string;
  interactive: boolean;
  disabled: boolean;
};

const avatar = (args: Args, interactive = args.interactive) =>
  html`<bit-avatar
    color=${args.color ?? nothing}
    avatar-id=${args.avatarId ?? nothing}
    text=${args.text ?? nothing}
    label=${args.label ?? nothing}
    size=${args.size}
    ?interactive=${interactive}
    ?disabled=${args.disabled}
  ></bit-avatar>`;

export default {
  title: "Component Library/Avatar",
  component: "bit-avatar",
  args: { text: "Walt Walterson", size: "base", interactive: false, disabled: false },
  argTypes: {
    size: { control: "select", options: ["sm", "base", "lg", "xl", "2xl"] },
  },
  render: (args) => avatar(args),
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = { args: { color: "brand" } };

export const Interactive: Story = { args: { color: "brand", interactive: true } };

const sizes = [
  ["sm", "small"],
  ["base", "base"],
  ["lg", "large"],
  ["xl", "xlarge"],
  ["2xl", "2xlarge"],
];

const sizeRow = (interactive: boolean) => html`
  <div class="tw-flex tw-gap-4 tw-mb-10">
    ${sizes.map(
      ([size, label]) => html`
        <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
          <span>${label}</span>
          <bit-avatar
            color="brand"
            text="Walt Walterson"
            size=${size}
            ?interactive=${interactive}
          ></bit-avatar>
        </div>
      `,
    )}
  </div>
`;

export const Sizes: Story = {
  render: () => html`
    <span class="tw-font-bold">Static</span>
    ${sizeRow(false)}
    <span class="tw-font-bold">Interactive</span>
    ${sizeRow(true)}
  `,
};

const palette = ["brand", "teal", "coral", "green", "purple"];
const paletteHex = ["#175ddc", "#007c95", "#c71800", "#008236", "#8200db"];

export const DefaultColors: Story = {
  render: () => html`
    <span class="tw-font-bold">Static</span>
    <div class="tw-flex tw-gap-2 tw-mb-10">
      ${palette.map((c) => html`<bit-avatar color=${c} text="Walt Walterson"></bit-avatar>`)}
    </div>
    <span class="tw-font-bold">Interactive</span>
    <div class="tw-flex tw-gap-2 tw-mb-10">
      ${palette.map(
        (c) => html`<bit-avatar interactive color=${c} text="Walt Walterson"></bit-avatar>`,
      )}
    </div>
    <span class="tw-font-bold">Interactive (Defaults as Hexes)</span>
    <div class="tw-flex tw-gap-2">
      ${paletteHex.map(
        (c) => html`<bit-avatar interactive color=${c} text="Walt Walterson"></bit-avatar>`,
      )}
    </div>
  `,
};

export const ColorByID: Story = {
  args: { avatarId: "236478" },
  render: (args) => html`
    <div class="tw-flex tw-gap-4">
      <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
        <span class="tw-font-bold">Static</span>
        ${avatar(args, false)}
      </div>
      <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
        <span class="tw-font-bold">Interactive</span>
        ${avatar(args, true)}
      </div>
    </div>
  `,
};

export const ColorByText: Story = { ...ColorByID, args: { text: "Jason Doe" } };

export const CustomColor: Story = { ...ColorByID, args: { color: "#fbd9fe" } };

export const InteractionStates: Story = {
  render: () => html`
    <div
      class="tw-grid tw-grid-cols-[auto_repeat(3,minmax(0,1fr))] tw-gap-x-4 tw-gap-y-4 tw-items-center tw-max-w-[700px]"
    >
      <span></span>
      <span class="tw-text-center">Avatar</span>
      <span class="tw-text-center">Hover</span>
      <span class="tw-text-center">Focus-visible</span>
      ${[
        ["Default Color", "brand"],
        ["Custom Color", "#fbd9fe"],
      ].map(
        ([label, color]) => html`
          <span class="tw-font-bold">${label}</span>
          ${["", "tw-test-hover", "tw-test-focus-visible"].map(
            (state) =>
              html`<bit-avatar
                interactive
                color=${color}
                text="Walt Walterson"
                class="tw-justify-self-center ${state}"
              ></bit-avatar>`,
          )}
        `,
      )}
    </div>
  `,
};

export const Inactive: Story = { args: { interactive: true, disabled: true } };
