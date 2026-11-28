import { html } from "lit";
import { customElement } from "lit/decorators.js";

import type { SubmitContext } from "../../async-actions/attach-submit-action";
import { submitAction } from "../../async-actions/submit-action-directive";
import { closeAllDialogs, openSimpleDialog } from "../../dialog/dialog-service";
import type { SelectItemView } from "../../multi-select/select-item-view";
import { typography } from "../../typography/typography";
import "../../button/button";
import "../../checkbox/checkbox";
import "../../color-password/color-password";
import "../../form-field/error-summary";
import "../../icon/icon";
import "../../input/input";
import "../../link/link";
import "../../multi-select/multi-select";
import "../../popover/popover";
import "../../progress/progress-bar";
import "../../radio-button/radio";
import "../../radio-button/radio-group";
import "../../select/option-element";
import "../../select/select";

import { KitchenSinkElement } from "./kitchen-sink-element";

const colors = [
  { value: "blue", name: "Blue" },
  { value: "white", name: "White" },
  { value: "gray", name: "Gray" },
];

const worstPasswords: SelectItemView[] = [
  "1234",
  "admin",
  "password",
  "querty",
  "letmein",
  "trustno1",
  "1qaz2wsx",
].map((name, i) => ({ id: String(i + 1), listName: name, labelName: name }));

/** @internal Stories only. */
@customElement("bit-kitchen-sink-form")
export class KitchenSinkForm extends KitchenSinkElement {
  private readonly submit = async ({ form }: SubmitContext) => {
    await openSimpleDialog({
      title: "Confirm",
      content: "Are you sure you want to submit?",
      type: "primary",
      acceptButtonText: "Yes",
      cancelButtonText: "No",
      acceptAction: async () => {
        Array.from(form.elements).forEach((el) =>
          (el as { markAsTouched?: () => void }).markAsTouched?.(),
        );
        closeAllDialogs();
      },
    });
  };

  render() {
    const helpId = `${this.uid}-password-help`;
    return html`
      <form ${submitAction(this.submit)}>
        <div class="tw-mb-6">
          <bit-progress-bar value="50"></bit-progress-bar>
        </div>

        <bit-input label="Your favorite feature" name="favFeature" required></bit-input>

        <bit-select label="Your favorite color" name="favColor" required>
          ${colors.map(
            (color) => html`<bit-option value=${color.value} label=${color.name}></bit-option>`,
          )}
        </bit-select>

        <bit-multi-select
          label="Your top 3 worst passwords"
          name="topWorstPasswords"
          .baseItems=${worstPasswords}
        ></bit-multi-select>

        <bit-input
          label="How many passwords do you have?"
          name="numPasswords"
          type="number"
          min="0"
          max="150"
        ></bit-input>

        <bit-input
          label="A random password"
          name="password"
          type="password"
          required
          password-toggle
        >
          <bit-link slot="label-end" id=${helpId} label="Password help">
            <bit-icon name="bwi-question-circle"></bit-icon>
          </bit-link>
        </bit-input>

        <div class="tw-mb-6">
          <span class="${typography("body1")} tw-text-main">
            An example of a strong password: &nbsp;
          </span>
          <bit-color-password
            class="tw-text-base"
            password="Wq$Jk😀7j  DX#rS5Sdi!z"
            show-count
          ></bit-color-password>
        </div>

        <bit-checkbox
          name="loveSecurity"
          label="Check if you love security"
          hint="Hint: the correct answer is yes!"
          required
        ></bit-checkbox>

        <bit-radio-group name="current" value="yes" label="Do you currently use Bitwarden?">
          <bit-radio value="yes" label="Yes"></bit-radio>
          <bit-radio value="no" label="No"></bit-radio>
        </bit-radio-group>

        <bit-button button-type="primary" type="submit">Submit</bit-button>
        <bit-error-summary></bit-error-summary>

        <bit-popover trigger=${helpId} heading="Password help">
          <div>A strong password has the following:</div>
          <ul class="tw-mt-2 tw-mb-0 tw-ps-4">
            <li>Letters</li>
            <li>Numbers</li>
            <li>Special characters</li>
          </ul>
        </bit-popover>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-kitchen-sink-form": KitchenSinkForm;
  }
}
