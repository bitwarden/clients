import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../form-control/form-control-group";
import "./switch";

type Args = { checked: boolean; disabled: boolean; label: string; hint: string };

export default {
  title: "Component Library/Form/Switch",
  component: "bit-switch",
  args: {
    checked: true,
    disabled: false,
    label: "Example switch",
    hint: "This is a hint for the switch",
  },
  decorators: [(story) => html`<div class="tw-max-w-[600px]">${story()}</div>`],
  render: (args) => html`
    <bit-switch
      ?checked=${args.checked}
      ?disabled=${args.disabled}
      label=${args.label}
      hint=${args.hint}
    ></bit-switch>
  `,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/branch/8UUiry70QWI1VjILxo75GS/Tailwind-Component-Library?m=auto&node-id=30341-13313&t=83S7fjfIUxQJsM2r-1",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const WithLongLabel: Story = {
  args: {
    label:
      "This example switch has a super long label. This is not recommended. Switch labels should be clear and concise. They should tell the user what turning on the switch will do.",
  },
};

export const WithForm: Story = {
  render: () => html`
    <form
      @change=${(event: Event) => {
        const form = event.currentTarget as HTMLFormElement;
        form.querySelector("output")!.textContent = `switch=${new FormData(form).get("switch")}`;
      }}
    >
      <bit-switch
        name="switch"
        label="Example switch"
        hint="This is a hint for the switch"
      ></bit-switch>
      <output class="tw-text-sm tw-text-fg-body">switch=null</output>
    </form>
  `,
};

export const Inactive: Story = { args: { disabled: true, checked: false } };

export const FormControlCard: Story = {
  render: () => html`
    <bit-switch
      card
      icon="bwi-clock"
      label="Enable feature"
      hint="This feature does some pretty cool stuff"
    ></bit-switch>
  `,
};

export const InactiveFormControlCard: Story = {
  render: () => html`
    <bit-switch
      card
      disabled
      icon="bwi-clock"
      label="Enable feature"
      hint="Enabling this feature will allow you to do cool things."
    ></bit-switch>
  `,
};

/** A group without `name` is only a layout; each switch submits itself. */
export const FormControlCardGroup: Story = {
  render: () => html`
    <form>
      <bit-form-control-group label="Notification preferences">
        <bit-switch
          card
          name="emailNotifications"
          icon="bwi-envelope"
          label="Email notifications"
          hint="Receive email updates for important activity"
        ></bit-switch>
        <bit-switch
          card
          name="autoLock"
          icon="bwi-lock"
          label="Auto-lock"
          hint="Automatically lock after inactivity"
        ></bit-switch>
      </bit-form-control-group>
    </form>
  `,
};
