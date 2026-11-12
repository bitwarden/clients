import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../icon-button/icon-button";
import "../button/button";
import "../input/input";
import "../input/textarea";
import "../select/option-element";
import "../select/select";

type Args = {
  label: string;
  hint: string;
  placeholder: string;
  size: "base" | "large";
  required: boolean;
  disabled: boolean;
  readonly: boolean;
};

export default {
  title: "Component Library/Form/Field",
  component: "bit-input",
  args: {
    label: "Label",
    hint: "Optional Hint",
    placeholder: "",
    size: "base",
    required: false,
    disabled: false,
    readonly: false,
  },
  argTypes: {
    size: { control: "radio", options: ["base", "large"] },
  },
  render: (args) => html`
    <bit-input
      label=${args.label}
      hint=${args.hint}
      placeholder=${args.placeholder}
      size=${args.size}
      ?required=${args.required}
      ?disabled=${args.disabled}
      ?readonly=${args.readonly}
    ></bit-input>
  `,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const InteractionStates: Story = {
  render: () => html`
    <bit-input label="Default"></bit-input>
    <bit-input id="hover-field" label="Hover"></bit-input>
    <bit-input id="focus-field" label="Focus"></bit-input>
    <bit-input id="hover-focus-field" label="Hover + Focus"></bit-input>
  `,
  play: async ({ canvasElement }) => {
    const container = async (id: string) => {
      const field = canvasElement.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>(
        `#${id}`,
      );
      await field?.updateComplete;
      return field?.shadowRoot?.querySelector("[part=container]");
    };
    (await container("hover-field"))?.classList.add("tw-test-hover");
    (await container("focus-field"))?.classList.add("tw-test-focus-visible");
    (await container("hover-focus-field"))?.classList.add("tw-test-hover", "tw-test-focus-visible");
  },
};

export const Large: Story = {
  render: () => html`
    <bit-input size="large" label="Label" required placeholder="Placeholder">
      <span slot="start">$</span>
      <span slot="end">USD</span>
    </bit-input>
  `,
};

export const LabelWithIcon: Story = {
  render: () => html`
    <bit-input label="Label" hint="Optional Hint">
      <a slot="label-end" href="#" class="tw-text-fg-brand" aria-label="More info" title="More info"
        ><i class="bwi bwi-question-circle" aria-hidden="true"></i
      ></a>
    </bit-input>
  `,
};

export const LongLabel: Story = {
  render: () => html`
    <div style="width: 200px">
      <bit-input
        label="Hello I am a very long label with lots of very cool helpful information"
        hint="Optional Hint"
      ></bit-input>
      <bit-input
        label="Hello I am a very long label with lots of very cool helpful information"
        hint="Optional Hint"
      >
        <a
          slot="label-end"
          href="#"
          class="tw-text-fg-brand"
          aria-label="More info"
          title="More info"
          ><i class="bwi bwi-question-circle" aria-hidden="true"></i
        ></a>
      </bit-input>
    </div>
  `,
};

export const Required: Story = {
  render: () => html`
    <bit-input label="Label" required placeholder="Placeholder"></bit-input>
    <bit-input label="Touched" required placeholder="Placeholder" id="touched"></bit-input>
  `,
  play: async ({ canvasElement }) => {
    canvasElement
      .querySelector<HTMLElement & { markAsTouched(): void }>("#touched")
      ?.markAsTouched();
  },
};

/**
 * A visually-hidden label keeps the field accessible while collapsing the label/field gap, so the
 * field stays vertically centered alongside sibling controls in a row.
 */
export const HiddenLabel: Story = {
  render: () => html`
    <div class="tw-flex tw-items-center tw-gap-2">
      <bit-input
        class="tw-w-44"
        label="Rows per page"
        hide-label
        disable-margin
        value="10"
      ></bit-input>
      <bit-icon-button icon="bwi-angle-left" size="small" label="Previous"></bit-icon-button>
      <bit-icon-button icon="bwi-angle-right" size="small" label="Next"></bit-icon-button>
    </div>
  `,
};

export const Hint: Story = {
  render: () => html`
    <bit-input
      label="FormControl"
      required
      placeholder="Placeholder"
      hint="Long hint text"
    ></bit-input>
  `,
};

export const Inactive: Story = {
  render: () => html`<bit-input label="Label" placeholder="Placeholder" disabled></bit-input>`,
};

export const Readonly: Story = {
  render: () => html`
    <bit-input label="Input" value="Foobar" readonly></bit-input>

    <bit-input label="Input" type="password" value="Foobar" readonly password-toggle>
      <bit-icon-button slot="end" icon="bwi-clone" label="Clone Input"></bit-icon-button>
    </bit-input>

    <bit-textarea
      label="Textarea"
      rows="4"
      readonly
      value="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    ></bit-textarea>

    <bit-textarea
      label="Textarea short"
      rows="1"
      readonly
      value="Lorem ipsum dolor sit ametroident"
    ></bit-textarea>

    <div class="tw-p-4 tw-mt-10 tw-border-2 tw-border-solid tw-border-black tw-bg-background-alt">
      <h2 class="tw-text-xl tw-font-medium tw-mb-4">Inside card</h2>
      <div
        class="tw-rounded-xl tw-border tw-border-solid tw-border-border-base tw-bg-bg-primary tw-p-4"
      >
        <bit-input label="Input" value="Foobar" readonly></bit-input>
        <bit-input label="Input" type="password" value="Foobar" readonly password-toggle>
          <bit-icon-button slot="end" icon="bwi-clone" label="Clone Input"></bit-icon-button>
        </bit-input>
        <bit-textarea label="Textarea" rows="3" readonly .value=${"Row1\nRow2\nRow3"}>
          <span
            slot="label-end"
            class="tw-rounded-full tw-bg-bg-success-soft tw-px-2 tw-text-xs tw-text-fg-success"
            >Premium</span
          >
        </bit-textarea>
        <bit-input label="Sans margin" value="Foobar" readonly disable-margin></bit-input>
      </div>
    </div>
  `,
};

export const InputGroup: Story = {
  render: () => html`
    <bit-input label="Label" required placeholder="Placeholder">
      <span slot="start">$</span>
      <span slot="end">USD</span>
    </bit-input>
  `,
};

export const InlineEndButton: Story = {
  render: () => html`
    <bit-input
      label="Allowed domains"
      placeholder="example.com"
      hint="Comma-separated list of email domains."
    >
      <bit-button slot="inline-end" button-type="primary">Save</bit-button>
    </bit-input>
  `,
};

export const ButtonInputGroup: Story = {
  render: () => html`
    <bit-input label="Label" placeholder="Placeholder">
      <a slot="label-end" href="#" class="tw-text-fg-brand" aria-label="More info" title="More info"
        ><i class="bwi bwi-question-circle" aria-hidden="true"></i
      ></a>
      <i slot="start" class="bwi bwi-star" role="img" aria-label="Favorite Label"></i>
      <bit-icon-button slot="end" icon="bwi-eye" label="Hide Label"></bit-icon-button>
      <bit-icon-button slot="end" icon="bwi-clone" label="Clone Label"></bit-icon-button>
      <bit-icon-button slot="end" icon="bwi-ellipsis-v" label="Menu Label"></bit-icon-button>
    </bit-input>
  `,
};

export const DangerButtonInputGroup: Story = {
  render: () => html`
    <bit-input label="Label" placeholder="Placeholder">
      <bit-icon-button
        slot="end"
        icon="bwi-minus-circle"
        button-type="dangerGhost"
        label="Remove"
      ></bit-icon-button>
    </bit-input>
  `,
};

export const InactiveButtonInputGroup: Story = {
  render: () => html`
    <bit-input label="Label" placeholder="Placeholder" disabled>
      <bit-icon-button
        slot="start"
        icon="bwi-star"
        disabled
        label="Favorite Label"
      ></bit-icon-button>
      <bit-icon-button slot="end" icon="bwi-eye" disabled label="Hide Label"></bit-icon-button>
      <bit-icon-button slot="end" icon="bwi-clone" disabled label="Clone Label"></bit-icon-button>
      <bit-icon-button
        slot="end"
        icon="bwi-ellipsis-v"
        disabled
        label="Menu Label"
      ></bit-icon-button>
    </bit-input>
  `,
};

export const PartiallyInactiveButtonInputGroup: Story = {
  render: () => html`
    <bit-input label="Label" placeholder="Placeholder" disabled>
      <bit-icon-button slot="end" icon="bwi-eye" label="Hide Label"></bit-icon-button>
      <bit-icon-button slot="end" icon="bwi-clone" label="Clone Label"></bit-icon-button>
      <bit-icon-button
        slot="end"
        icon="bwi-ellipsis-v"
        disabled
        label="Menu Label"
      ></bit-icon-button>
    </bit-input>
  `,
};

/** Angular's native `<select bitInput>` story; native selects are replaced by `bit-select`. */
export const Select: Story = {
  render: () => html`
    <bit-select label="Label">
      <bit-option value="select" label="Select"></bit-option>
      <bit-option value="other" label="Other"></bit-option>
    </bit-select>
  `,
};

export const AdvancedSelect: Story = {
  render: () => html`
    <bit-select label="Label">
      <bit-option value="value1" label="Option 1"></bit-option>
      <bit-option value="value2" label="Option 2"></bit-option>
    </bit-select>
  `,
};

export const LargeAdvancedSelect: Story = {
  render: () => html`
    <bit-select label="Label" size="large">
      <bit-option value="value1" label="Option 1"></bit-option>
      <bit-option value="value2" label="Option 2"></bit-option>
    </bit-select>
  `,
};

export const NumberInput: Story = {
  render: () => html`
    <bit-input label="Amount" type="number" placeholder="0" hint="Enter a numeric value.">
      <span slot="end">USD</span>
    </bit-input>
  `,
};

export const DateInput: Story = {
  render: () => html`<bit-input label="Date" type="date" hint="Select a date"></bit-input>`,
};

export const Textarea: Story = {
  render: () => html`
    <bit-textarea
      label="Textarea"
      rows="4"
      value="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
      hint="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
    >
      <bit-icon-button slot="end" icon="bwi-clone" label="Clone Label"></bit-icon-button>
    </bit-textarea>
    <bit-textarea
      label="Textarea disabled"
      rows="4"
      disabled
      value="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
      hint="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
    >
      <bit-icon-button slot="end" icon="bwi-clone" label="Clone Label"></bit-icon-button>
    </bit-textarea>
    <bit-textarea
      label="Textarea readonly"
      rows="4"
      readonly
      value="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
      hint="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
    >
      <bit-icon-button slot="end" icon="bwi-clone" label="Clone Label"></bit-icon-button>
    </bit-textarea>
  `,
};

/** Rich label and hint content via slots instead of the `label`/`hint` properties. */
export const SlottedLabelAndHint: Story = {
  render: () => html`
    <bit-input>
      <span slot="label">Slotted <strong>label</strong></span>
      <span slot="hint">Slotted hint with a <a href="#" class="tw-text-fg-brand">link</a></span>
    </bit-input>
  `,
};
