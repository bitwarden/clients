import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./radio";
import "./radio-group";

export default {
  title: "Component Library/Form/Radio Button",
  component: "bit-radio-group",
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-35836&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta;

type Story = StoryObj;

const options = ["First", "Second", "Third"];

const inline = (attrs: { hint?: string; required?: boolean; disabled?: boolean } = {}) => html`
  <form>
    <bit-radio-group
      name="radio"
      value="0"
      label="Group of radio buttons"
      hint=${attrs.hint ?? ""}
      ?required=${attrs.required}
    >
      ${options.map(
        (label, i) =>
          html`<bit-radio
            value=${String(i)}
            label=${label}
            ?disabled=${attrs.disabled}
          ></bit-radio>`,
      )}
    </bit-radio-group>
  </form>
`;

const block = (groupHint = "") => html`
  <form>
    <bit-radio-group name="radio" value="0" block label="Group of radio buttons" hint=${groupHint}>
      ${options.map(
        (label, i) =>
          html`<bit-radio
            value=${String(i)}
            label=${label}
            hint="This is a hint for the ${label.toLowerCase()} option"
          ></bit-radio>`,
      )}
    </bit-radio-group>
  </form>
`;

export const Inline: Story = { render: () => inline() };

export const InlineHint: Story = {
  render: () => inline({ hint: "This is a hint for the radio group" }),
};

export const Block: Story = { render: () => block() };

export const BlockHint: Story = { render: () => block("This is a hint for the radio group") };

export const Required: Story = { render: () => inline({ required: true }) };

export const Inactive: Story = { render: () => inline({ disabled: true }) };

const cardGroup = (
  attrs: { grid?: boolean; disabled?: boolean } = {},
  labels = ["Option A", "Option B", "Option C"],
  hints: string[] = [],
) => html`
  <form>
    <bit-radio-group
      name="radio"
      value="0"
      ?block=${!attrs.grid}
      ?grid=${attrs.grid}
      label="Select an option"
      hint="Choose one of the options above."
    >
      ${labels.map(
        (label, i) =>
          html`<bit-radio
            card
            value=${String(i)}
            label=${label}
            hint=${hints[i] ?? ""}
            ?disabled=${attrs.disabled}
          ></bit-radio>`,
      )}
    </bit-radio-group>
  </form>
`;

export const FormControlCard: Story = { render: () => cardGroup() };

export const InactiveFormControlCard: Story = { render: () => cardGroup({ disabled: true }) };

export const FormControlCardGroupGrid: Story = {
  render: () =>
    cardGroup(
      { grid: true },
      ["Option A", "Option B", "Option C", "Option D"],
      [
        "The first available option",
        "The second available option",
        "The third available option",
        "The fourth available option",
      ],
    ),
};

export const FormControlCardGroupGridLongLabels: Story = {
  render: () => html`
    <form>
      <bit-radio-group name="radio" value="0" grid label="Select an option">
        <bit-radio
          card
          value="0"
          label="A password manager with an extremely long vendor name"
        ></bit-radio>
        <bit-radio card value="1" label="Supercalifragilisticexpialidocious"></bit-radio>
        <bit-radio
          card
          value="2"
          title="Custom tooltip text"
          label="Option with an overridden title"
        ></bit-radio>
        <bit-radio card value="3" label="Option D"></bit-radio>
      </bit-radio-group>
    </form>
  `,
};

export const FormControlCardCustomSlot: Story = {
  render: () => html`
    <form>
      <bit-radio-group
        name="radio"
        value="0"
        block
        label="Select an option"
        hint='Each card projects a custom icon via slot="start".'
      >
        ${["Option A", "Option B", "Option C"].map(
          (label, i) =>
            html`<bit-radio card value=${String(i)} label=${label}>
              <i
                slot="start"
                class="bwi bwi-lock tw-text-4xl tw-text-fg-brand"
                aria-hidden="true"
              ></i>
            </bit-radio>`,
        )}
      </bit-radio-group>
    </form>
  `,
};

/**
 * Only the selected radio is in the tab order. Arrow keys move the selection and skip disabled
 * radios; the form submits the group's `value`.
 */
export const KeyboardNavigation: Story = {
  render: () => html`
    <form
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        form.querySelector("output")!.textContent = `radio=${new FormData(form).get("radio")}`;
      }}
      @change=${(event: Event) => (event.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <bit-radio-group name="radio" value="1" label="Use the arrow keys">
        <bit-radio value="0" label="First"></bit-radio>
        <bit-radio value="1" label="Second"></bit-radio>
        <bit-radio value="2" label="Disabled" disabled></bit-radio>
        <bit-radio value="3" label="Fourth"></bit-radio>
      </bit-radio-group>
      <output class="tw-text-sm tw-text-fg-body"></output>
    </form>
  `,
};
