import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { ControlContainer, ReactiveFormsModule } from "@angular/forms";

import { FormFieldModule, RadioButtonModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** A radio group of Keeper's login methods. The control belongs to the login card's form; this
 *  only draws it. */
@Component({
  selector: "importer-controls-keeper-method-picker",
  templateUrl: "./import-controls-keeper-method-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldModule, I18nPipe, RadioButtonModule, ReactiveFormsModule],
  // Registers the group with the card's form exactly as if it were written inline there.
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) },
  ],
  host: { class: "tw-contents" },
})
export class ImportControlsKeeperMethodPickerComponent<T extends number> {
  /** Name of the control in the card's form. */
  readonly controlName = input.required<string>();
  readonly labelKey = input.required<string>();
  /** Radio ids are this followed by the method, so QA ids stay stable. */
  readonly idPrefix = input.required<string>();
  readonly methods = input.required<readonly T[]>();
  readonly labelFn = input.required<(method: T) => string>();
}
