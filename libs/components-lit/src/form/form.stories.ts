import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { submitAction } from "../async-actions/submit-action-directive";
import { Validators } from "../core/validators";
import "../button/button";
import "../checkbox/checkbox";
import "../form-field/error-summary";
import "../input/input";
import "../multi-select/multi-select";
import type { SelectItemView } from "../multi-select/select-item-view";
import "../radio-button/radio";
import "../radio-button/radio-group";
import "../select/option-element";
import "../select/select";
import { countries } from "../table/story-countries";

export default {
  title: "Component Library/Form",
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta;

type Story = StoryObj;

const groups: SelectItemView[] = Array.from({ length: 7 }, (_, i) => ({
  id: String(i + 1),
  listName: `Group ${i + 1}`,
  labelName: `Group ${i + 1}`,
  icon: "bwi-family",
}));

const showResult = ({
  form,
  formData,
  valid,
}: {
  form: HTMLFormElement;
  formData: FormData;
  valid: boolean;
}) => {
  const output = form.querySelector("output");
  if (output) {
    output.textContent = valid
      ? new URLSearchParams(formData as unknown as Record<string, string>).toString()
      : "";
  }
};

export const FullExample: Story = {
  render: () => html`
    <form ${submitAction(showResult)}>
      <bit-input label="Name" name="name" required></bit-input>
      <bit-input
        label="Email"
        name="email"
        required
        .validators=${[Validators.email, Validators.forbiddenCharacters(["#"])]}
      ></bit-input>
      <bit-select label="Country" name="country" required>
        ${countries.map(
          (country) => html`<bit-option value=${country.value} label=${country.name}></bit-option>`,
        )}
      </bit-select>
      <bit-multi-select label="Groups" name="groups" .baseItems=${groups}></bit-multi-select>
      <bit-input label="Age" name="age" type="number" min="0" max="150"></bit-input>
      <bit-checkbox
        name="terms"
        label="Agree to terms"
        hint="Required for the service to work properly"
        required
      ></bit-checkbox>
      <bit-radio-group name="updates" value="yes" label="Subscribe to updates?">
        <bit-radio value="yes" label="Yes"></bit-radio>
        <bit-radio value="no" label="No"></bit-radio>
        <bit-radio value="later" label="Decide later"></bit-radio>
      </bit-radio-group>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
      <output class="tw-block tw-mt-2 tw-text-sm tw-text-fg-body"></output>
    </form>
  `,
};

export const Validations: Story = {
  render: () => html`
    <form ${submitAction(() => {})}>
      <bit-input
        label="Required validation"
        required
        hint="This field is required. Submit form or blur input to see error"
      ></bit-input>
      <bit-input
        label="Email validation"
        type="email"
        value="example?bad-email"
        hint="This field contains a malformed email address. Submit form or blur input to see error"
      ></bit-input>
      <bit-input
        label="Min length validation"
        minlength="8"
        value="Hello"
        hint="Value must be at least 8 characters. Submit form or blur input to see error"
      ></bit-input>
      <bit-input
        label="Max length validation"
        .validators=${[Validators.maxLength(8)]}
        value="Hello there"
        hint="Value must be less then 8 characters. Submit form or blur input to see error"
      ></bit-input>
      <bit-input
        label="Min number value validation"
        type="number"
        min="10"
        value="9"
        hint="Value must be greater than 10. Submit form or blur input to see error"
      ></bit-input>
      <bit-input
        label="Max number value validation"
        type="number"
        max="10"
        value="15"
        hint="Value must be less than than 10. Submit form or blur input to see error"
      ></bit-input>
      <bit-input
        label="Forbidden characters validation"
        value="Th!$ value cont#in$ forbidden char$"
        .validators=${[Validators.forbiddenCharacters(["#", "!", "$"])]}
        hint="Value must not contain '#', '!' or '$'. Submit form or blur input to see error"
      ></bit-input>
      <bit-input
        label="White space validation"
        value="    "
        .validators=${[Validators.trim]}
        hint="This input contains only white space. Submit form or blur input to see error"
      ></bit-input>
      <bit-button type="submit" button-type="primary">Submit</bit-button>
      <bit-error-summary></bit-error-summary>
    </form>
  `,
  play: async ({ canvasElement }) => {
    await customElements.whenDefined("bit-input");
    canvasElement.querySelector("form")?.requestSubmit();
  },
};
