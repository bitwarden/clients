import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { LinkType, LinkTypes } from "./link";

type Args = { linkType: LinkType };

const background = (linkType: string) =>
  linkType === "contrast"
    ? "tw-bg-bg-contrast"
    : linkType === "light"
      ? "tw-bg-bg-brand"
      : "tw-bg-transparent";

const variations: [LinkType, string][] = [
  ["primary", "Primary (Deprecated -- use Default instead)"],
  ["default", "Default"],
  ["secondary", "Secondary (Deprecated -- use Subtle instead)"],
  ["subtle", "Subtle"],
  ["contrast", "Contrast"],
  ["light", "Light"],
  ["success", "Success"],
  ["warning", "Warning"],
  ["danger", "Danger"],
];

export default {
  title: "Component Library/Link",
  component: "bit-link",
  args: { linkType: "primary" },
  argTypes: { linkType: { options: [...LinkTypes], control: { type: "radio" } } },
  render: (args) => html`
    <div class="tw-p-2 ${background(args.linkType)}">
      <bit-link href="#" link-type=${args.linkType}>Your text here</bit-link>
    </div>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

const noControls = { controls: { exclude: ["linkType"], hideNoControlsWarning: true } };

export const Default: Story = {};

export const AllVariations: Story = {
  parameters: noControls,
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-6">
      ${variations.map(
        ([type, label]) => html`
          <div class="tw-flex tw-gap-4 tw-p-2 ${background(type)}">
            <bit-link link-type=${type} href="#">${label}</bit-link>
          </div>
        `,
      )}
    </div>
  `,
};

export const InteractionStates: Story = {
  parameters: noControls,
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-6">
      ${variations.map(
        ([type, label]) => html`
          <div class="tw-flex tw-gap-4 tw-p-2 ${background(type)}">
            <bit-link link-type=${type} href="#">${label}</bit-link>
            <bit-link link-type=${type} href="#" class="tw-test-hover">${label}</bit-link>
            <bit-link link-type=${type} href="#" class="tw-test-focus-visible">${label}</bit-link>
            <bit-link link-type=${type} href="#" class="tw-test-hover tw-test-focus-visible"
              >${label}</bit-link
            >
          </div>
        `,
      )}
    </div>
  `,
};

export const Buttons: Story = {
  render: (args) => html`
    <div class="tw-p-2 ${background(args.linkType)}">
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType}>Button</bit-link>
      </div>
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} start-icon="bwi-plus-circle">Add Icon Button</bit-link>
      </div>
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} end-icon="bwi-angle-right"
          >Chevron Icon Button</bit-link
        >
      </div>
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} class="tw-text-sm">Small Button</bit-link>
      </div>
    </div>
  `,
};

export const Anchors: Story = {
  render: (args) => html`
    <div class="tw-p-2 ${background(args.linkType)}">
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} href="#">Anchor</bit-link>
      </div>
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} href="#" start-icon="bwi-plus-circle"
          >Add Icon Anchor</bit-link
        >
      </div>
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} href="#" end-icon="bwi-angle-right"
          >Chevron Icon Anchor</bit-link
        >
      </div>
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} href="#" class="tw-text-sm">Small Anchor</bit-link>
      </div>
    </div>
  `,
};

export const Inline: Story = {
  render: () => html`
    <span class="tw-text-main">
      On the internet paragraphs often contain
      <bit-link href="#">inline links with very long text that might break</bit-link>, but few know
      that <bit-link>buttons</bit-link> can be used for similar purposes.
    </span>
  `,
};

export const WithIcons: Story = {
  render: (args) => html`
    <div class="tw-p-2 ${background(args.linkType)}">
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} href="#" start-icon="bwi-star"
          >Start icon link</bit-link
        >
      </div>
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} href="#" end-icon="bwi-external-link"
          >External link</bit-link
        >
      </div>
      <div class="tw-block tw-p-2">
        <bit-link
          link-type=${args.linkType}
          href="#"
          start-icon="bwi-angle-left"
          end-icon="bwi-angle-right"
          >Both icons</bit-link
        >
      </div>
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} start-icon="bwi-plus-circle">Add item</bit-link>
      </div>
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} end-icon="bwi-angle-right">Next</bit-link>
      </div>
      <div class="tw-block tw-p-2">
        <bit-link link-type=${args.linkType} start-icon="bwi-download" end-icon="bwi-check"
          >Download complete</bit-link
        >
      </div>
    </div>
  `,
};

export const Truncated: Story = {
  parameters: noControls,
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-4 tw-p-2 tw-w-64">
      <bit-link truncate href="#">Anchor with a really long name that does not fit</bit-link>
      <bit-link truncate href="#" start-icon="bwi-star" end-icon="bwi-external-link">
        Anchor with icons and a really long name that does not fit
      </bit-link>
      <bit-link truncate>Button with a really long name that does not fit</bit-link>
      <bit-link truncate href="#">Short</bit-link>
      <bit-link href="#"
        >Without truncate, a really long name that does not fit wraps or overflows</bit-link
      >
    </div>
  `,
};

export const Inactive: Story = {
  parameters: noControls,
  render: () => html`
    <bit-link
      disabled
      link-type="primary"
      class="tw-me-2"
      @click=${() => alert("Button clicked! (This should not appear when disabled)")}
      >Primary button</bit-link
    >
    <bit-link href="#" disabled link-type="primary" class="tw-me-2"
      >Links can not be inactive</bit-link
    >
    <bit-link disabled link-type="secondary" class="tw-me-2">Secondary button</bit-link>
    <div class="tw-bg-bg-contrast tw-p-2 tw-inline-block">
      <bit-link disabled link-type="contrast">Contrast button</bit-link>
    </div>
  `,
};

export const InForm: Story = {
  parameters: noControls,
  render: () => html`
    <form
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const output = (event.target as HTMLFormElement).querySelector("output");
        if (output) {
          output.textContent = `Submitted: ${JSON.stringify(Object.fromEntries(new FormData(event.target as HTMLFormElement, event.submitter)))}`;
        }
      }}
    >
      <bit-link type="submit" name="intent" value="skip">Skip for now</bit-link>
      <output class="tw-block tw-text-sm tw-mt-2"></output>
    </form>
  `,
};
