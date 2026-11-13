import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../form-control/form-control-group";
import "./checkbox";

type Args = {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  required: boolean;
  indeterminate: boolean;
};

export default {
  title: "Component Library/Form/Checkbox",
  component: "bit-checkbox",
  args: {
    label: "Click me",
    hint: "",
    checked: false,
    disabled: false,
    required: true,
    indeterminate: false,
  },
  render: (args) => html`
    <bit-checkbox
      label=${args.label}
      hint=${args.hint}
      ?checked=${args.checked}
      ?disabled=${args.disabled}
      ?required=${args.required}
      ?indeterminate=${args.indeterminate}
    ></bit-checkbox>
  `,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-35837&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {
  render: () => html`
    <form>
      <bit-checkbox name="checkbox" label="Click me" required></bit-checkbox>
      <bit-checkbox name="checkbox" label="Click me" required checked></bit-checkbox>
    </form>
  `,
};

export const LongLabel: Story = {
  render: () => html`
    <form class="tw-w-96">
      <bit-checkbox
        label="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur iaculis consequat enim vitae elementum. Ut non odio est."
      ></bit-checkbox>
      <bit-checkbox
        label="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur iaculis consequat enim vitae elementum. Ut non odio est."
      >
        <span
          slot="label-end"
          class="tw-rounded-full tw-bg-bg-success-soft tw-px-2 tw-text-xs tw-text-fg-success"
          >Premium</span
        >
      </bit-checkbox>
    </form>
  `,
};

export const Hint: Story = {
  render: () => html`
    <bit-checkbox
      label="Really long value that never ends."
      hint="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur iaculis consequat enim vitae elementum. Ut non odio est. Duis eu nisi ultrices, porttitor lorem eget, ornare libero. Fusce ex ante, consequat ac sem et, euismod placerat tellus."
    ></bit-checkbox>
  `,
};

export const Inactive: Story = {
  render: () => html`
    <bit-checkbox label="Click me" required disabled></bit-checkbox>
    <bit-checkbox label="Click me" required disabled checked></bit-checkbox>
  `,
};

/** A bare checkbox laid out by the consumer; `hide-label` keeps the accessible name. */
export const Custom: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-w-32">
      ${["A-Z", "a-z", "0-9"].map(
        (label) =>
          html`<div
            class="tw-text-main tw-gap-2 tw-flex tw-items-center tw-justify-between tw-bg-secondary-300 tw-p-2"
          >
            <span aria-hidden="true">${label}</span>
            <bit-checkbox label=${label} hide-label disable-margin></bit-checkbox>
          </div>`,
      )}
    </div>
  `,
};

export const Indeterminate: Story = {
  render: () => html`<bit-checkbox label="Indeterminate" indeterminate></bit-checkbox>`,
};

export const InTableRow: Story = {
  render: () => html`
    <table class="tw-w-full tw-text-start tw-text-fg-heading">
      <thead>
        <tr class="tw-border-0 tw-border-b tw-border-solid tw-border-border-base">
          <th class="tw-p-3 tw-text-start">
            <bit-checkbox label="All" disable-margin></bit-checkbox>
          </th>
          <th class="tw-p-3 tw-text-start">Foo</th>
          <th class="tw-p-3 tw-text-start">Bar</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="tw-p-3">
            <bit-checkbox label="Check row 0" hide-label disable-margin></bit-checkbox>
          </td>
          <td class="tw-p-3">Lorem</td>
          <td class="tw-p-3">Ipsum</td>
        </tr>
      </tbody>
    </table>
  `,
};

export const FormControlCard: Story = {
  render: () => html`
    <bit-checkbox
      card
      icon="bwi-clock"
      label="Enable feature"
      hint="Enabling this feature will allow you to do cool things."
    ></bit-checkbox>
  `,
};

export const FormControlCardCustomSlot: Story = {
  render: () => html`
    <bit-checkbox
      card
      label="Enable feature"
      hint='Projected via slot="start" — any element works here.'
    >
      <i slot="start" class="bwi bwi-lock tw-text-4xl tw-text-fg-brand" aria-hidden="true"></i>
    </bit-checkbox>
  `,
};

export const InactiveFormControlCard: Story = {
  render: () => html`
    <bit-checkbox
      card
      icon="bwi-clock"
      label="Enable feature"
      hint="Enabling this feature will allow you to do cool things."
      checked
      disabled
    ></bit-checkbox>
  `,
};

const cards = (grid = false) => html`
  <bit-checkbox
    card
    icon=${grid ? "bwi-envelope" : ""}
    value="featureA"
    label="Feature A"
    hint="Enables Feature A for your account"
  ></bit-checkbox>
  <bit-checkbox
    card
    icon=${grid ? "bwi-envelope" : ""}
    value="featureB"
    label="Feature B"
    hint="Enables Feature B for your account"
  ></bit-checkbox>
  <bit-checkbox
    card
    icon=${grid ? "bwi-envelope" : ""}
    value="featureC"
    label="Feature C"
    hint=${grid ? "Enables Feature C for your account" : ""}
  ></bit-checkbox>
  ${grid ? html`<bit-checkbox card icon="bwi-envelope" value="featureD" label="Feature D" hint="Enables Feature D for your account"></bit-checkbox>` : ""}
`;

/** The group submits the checked values under its `name`; `required` needs at least one. */
export const FormControlCardGroup: Story = {
  render: () => html`
    <form>
      <bit-form-control-group
        name="features"
        required
        label="Checkbox group"
        hint="Choose which features to enable."
      >
        ${cards()}
      </bit-form-control-group>
    </form>
  `,
};

export const FormControlCardGroupGrid: Story = {
  render: () => html`
    <form>
      <bit-form-control-group
        name="features"
        required
        grid
        label="Checkbox group"
        hint="Choose which features to enable."
      >
        ${cards(true)}
      </bit-form-control-group>
    </form>
  `,
};

export const FormControlCardGroupWithValidation: Story = {
  render: () => html`
    <form>
      <bit-form-control-group
        name="features"
        required
        label="Checkbox group"
        hint="Choose which features to enable."
      >
        ${cards()}
      </bit-form-control-group>
    </form>
  `,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("bit-form-control-group")?.markAsTouched();
  },
};
