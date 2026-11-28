import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "../dialog/dialog";
import { openDialog } from "../dialog/dialog-service";

import type { SelectOption } from "./option";
import "./option-element";
import "./select";

type Args = { disabled: boolean };

const defaultOptions = html`
  <bit-option
    value="value1"
    label="Value 1"
    icon="bwi-shared-folder"
    description="Very cool hint text that is also incredibly long, so helpful that it will need to truncate if you shrink the window width"
  ></bit-option>
  <bit-option
    value="value2"
    label="Value 2 very long label though so it will truncate on small screen"
    icon="bwi-shared-folder"
  ></bit-option>
  <bit-option value="value3" label="Value 3" icon="bwi-shared-folder"></bit-option>
  <bit-option value="value4" label="Value 4" icon="bwi-shared-folder" disabled></bit-option>
`;

const openFirstSelect = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const select = canvasElement.querySelector("bit-select");
  await select?.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  select?.shadowRoot?.querySelector<HTMLElement>("[role=combobox]")?.click();
};

export default {
  title: "Component Library/Form/Select",
  component: "bit-select",
  args: { disabled: false },
  render: (args) =>
    html`<bit-select label="Choose a value" ?disabled=${args.disabled}
      >${defaultOptions}</bit-select
    >`,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const IconTiles: Story = {
  render: (args) =>
    html`<bit-select label="Choose a value" ?disabled=${args.disabled}>
      <bit-option
        value="login"
        label="Login"
        .iconTile=${{ icon: "bwi-globe", variant: "brand" }}
        description="Very cool hint text that is also incredibly long, so helpful that it will need to truncate if you shrink the window width"
      ></bit-option>
      <bit-option
        value="card"
        label="Card with a very long label though so it will truncate on small screens"
        .iconTile=${{ icon: "bwi-credit-card", variant: "teal" }}
      ></bit-option>
      <bit-option
        value="identity"
        label="Identity"
        .iconTile=${{ icon: "bwi-id-card", variant: "purple", emphasis: "bold" }}
      ></bit-option>
      <bit-option
        value="note"
        label="Note with a custom color"
        .iconTile=${{ icon: "bwi-sticky-note", color: "#f8e71c" }}
      ></bit-option>
      <bit-option
        value="sshKey"
        label="SSH key"
        icon-tile='{"icon": "bwi-key", "variant": "green"}'
        disabled
      ></bit-option>
    </bit-select>`,
};

/** The listbox open, with the selected option marked. */
export const Open: Story = {
  render: () =>
    html`<div class="tw-h-72">
      <bit-select label="Choose a value" value="value2">${defaultOptions}</bit-select>
    </div>`,
  play: openFirstSelect,
};

const fruit: SelectOption<{ id: number }>[] = [
  { value: { id: 1 }, label: "Apple", icon: "bwi-star", metaData: "Red" },
  { value: { id: 2 }, label: "Pear", icon: "bwi-star", metaData: "Green" },
  { value: { id: 3 }, label: "Banana", icon: "bwi-star", metaData: "Yellow", disabled: true },
];

/** Options as data through `items`; values can be any type and are compared with `===`. */
export const Items: Story = {
  render: () =>
    html`<bit-select
      label="Fruit"
      hint="Values are objects"
      .items=${fruit}
      .value=${fruit[1].value}
    ></bit-select>`,
};

/** Form-associated: submits the value under `name`; `required` validates on blur or submit. */
export const InForm: Story = {
  render: () =>
    html`<form
      class="tw-max-w-sm"
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        form.querySelector("output")!.textContent = JSON.stringify(
          Object.fromEntries(new FormData(form)),
        );
      }}
    >
      <bit-select label="Choose a value" name="choice" required>${defaultOptions}</bit-select>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
      <bit-button type="reset">Reset</bit-button>
      <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
    </form>`,
};

/** Escape closes the listbox without closing the dialog. */
export const InDialog: Story = {
  render: () =>
    html`<bit-button
      @click=${() =>
        openDialog(
          () =>
            html`<bit-dialog heading="Select in a dialog">
              <bit-select label="Choose a value">${defaultOptions}</bit-select>
              <bit-button slot="footer" button-type="primary" data-bit-dialog-close
                >Done</bit-button
              >
            </bit-dialog>`,
        )}
      >Open dialog</bit-button
    >`,
};
